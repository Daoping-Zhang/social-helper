const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const defaults = require('../defaults');
const { requireAdmin, hashPassword, publicUser } = require('../auth');
const { asyncHandler, relToUrl, toRel, safeJson } = require('../util');
const { projectDetail, taskView, imageView } = require('../services');
const { startTask, TYPE_LABEL } = require('../aiService');
const { resolveParams, getCreditCost, getWorkflowConfig } = require('../params');
const { getSchema, validateParams } = require('../paramSchema');
const { changeCredits, transactionsFor, allTransactions } = require('../credits');

const router = express.Router();
router.use(requireAdmin);

const WORKFLOW_TYPES = ['wash', 'faceswap', 'enhance'];

// 调试用上传接口：上传任意图片，返回可访问 URL（curl / Postman 调试用）
const debugUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.DEBUG_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `debug-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

router.post('/upload', debugUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件（multipart 字段名 file）' });
  const rel = toRel(req.file.path);
  res.json({ url: relToUrl(rel), fileName: rel });
});

// ---------------- Dashboard ----------------
router.get('/dashboard', (req, res) => {
  const n = (sql) => db.prepare(sql).get().c;
  const stats = {
    users: {
      total: n('SELECT COUNT(*) c FROM users WHERE role = \'user\''),
      today_new: n("SELECT COUNT(*) c FROM users WHERE date(created_at) = date('now')"),
      today_active: n("SELECT COUNT(DISTINCT user_id) c FROM ai_tasks WHERE date(created_at) = date('now')"),
    },
    generation: {
      today_projects: n("SELECT COUNT(*) c FROM projects WHERE date(created_at) = date('now')"),
      today_wash: n("SELECT COUNT(*) c FROM ai_tasks WHERE workflow_type = 'wash' AND date(created_at) = date('now')"),
      today_faceswap: n("SELECT COUNT(*) c FROM ai_tasks WHERE workflow_type = 'faceswap' AND date(created_at) = date('now')"),
      today_enhance: n("SELECT COUNT(*) c FROM ai_tasks WHERE workflow_type = 'enhance' AND date(created_at) = date('now')"),
    },
    ai: {
      success: n("SELECT COUNT(*) c FROM ai_tasks WHERE status = 'success'"),
      failed: n("SELECT COUNT(*) c FROM ai_tasks WHERE status = 'failed'"),
      running: n("SELECT COUNT(*) c FROM ai_tasks WHERE status = 'running'"),
      today_failed: n("SELECT COUNT(*) c FROM ai_tasks WHERE status = 'failed' AND date(created_at) = date('now')"),
    },
    credits: {
      today_consumed: n("SELECT COALESCE(SUM(-delta),0) c FROM credit_transactions WHERE delta < 0 AND date(created_at) = date('now')"),
      remaining_total: n("SELECT COALESCE(SUM(credits),0) c FROM users WHERE role = 'user'"),
    },
  };
  stats.ai.success_rate =
    stats.ai.success + stats.ai.failed > 0
      ? Math.round((stats.ai.success / (stats.ai.success + stats.ai.failed)) * 100)
      : 100;
  stats.ai.avg_seconds =
    db
      .prepare(
        "SELECT AVG((julianday(completed_at)-julianday(started_at))*86400) s FROM ai_tasks WHERE status='success' AND completed_at IS NOT NULL AND started_at IS NOT NULL"
      )
      .get().s || 0;

  const recentProjects = db
    .prepare('SELECT * FROM projects ORDER BY id DESC LIMIT 8')
    .all()
    .map((p) => {
      const u = db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(p.user_id);
      const d = projectDetail(p.id);
      return {
        id: p.id,
        user: u ? u.display_name : null,
        status: p.status,
        created_at: p.created_at,
        cover: d.final ? d.final.url : d.selected_wash ? d.selected_wash.url : d.reference ? d.reference.url : null,
      };
    });
  const recentFailed = db
    .prepare("SELECT * FROM ai_tasks WHERE status = 'failed' ORDER BY id DESC LIMIT 8")
    .all()
    .map((t) => ({
      id: t.id,
      workflow_type: t.workflow_type,
      error: t.error,
      created_at: t.created_at,
      user: t.user_id ? (db.prepare('SELECT display_name FROM users WHERE id = ?').get(t.user_id) || {}).display_name : null,
    }));

  res.json({ stats, recentProjects, recentFailed });
});

// ---------------- Users ----------------
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  const list = rows.map((u) => {
    const p = db.prepare('SELECT COUNT(*) c FROM projects WHERE user_id = ?').get(u.id).c;
    const t = db.prepare('SELECT MAX(created_at) m FROM ai_tasks WHERE user_id = ?').get(u.id).m;
    return { ...publicUser(u), project_count: p, last_used: t };
  });
  res.json({ users: list });
});

router.post('/users', (req, res) => {
  const { username, password, display_name, credits = 0, note = '', status = 'active' } = req.body || {};
  if (!username || !password || !display_name) return res.status(400).json({ error: '请填写账号、密码和用户名称' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (exists) return res.status(409).json({ error: '账号已存在' });
  const c = Number(credits) || 0;
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, display_name, role, credits, status, note)
       VALUES (?, ?, ?, 'user', 0, ?, ?)`
    )
    .run(String(username).trim(), hashPassword(String(password)), String(display_name), status === 'disabled' ? 'disabled' : 'active', note || '');
  if (c > 0) {
    changeCredits(Number(info.lastInsertRowid), c, '管理员充值（初始额度）');
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ user: publicUser(user) });
});

router.get('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const stats = {
    projects: db.prepare('SELECT COUNT(*) c FROM projects WHERE user_id = ?').get(u.id).c,
    wash: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'wash'").get(u.id).c,
    faceswap: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'faceswap'").get(u.id).c,
    enhance: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'enhance'").get(u.id).c,
    spent: db.prepare('SELECT COALESCE(SUM(-delta),0) c FROM credit_transactions WHERE user_id = ? AND delta < 0').get(u.id).c,
  };
  const projects = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id DESC').all(u.id).map((p) => {
    const d = projectDetail(p.id);
    return { id: p.id, status: p.status, created_at: p.created_at, cover: d.final ? d.final.url : d.reference ? d.reference.url : null };
  });
  res.json({ user: publicUser(u), stats, projects, transactions: transactionsFor(u.id) });
});

router.patch('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const { display_name, note, status, password } = req.body || {};
  db.prepare('UPDATE users SET display_name = ?, note = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    display_name ?? u.display_name,
    note ?? u.note,
    status === 'disabled' ? 'disabled' : status === 'active' ? 'active' : u.status,
    u.id
  );
  if (password) {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashPassword(String(password)), u.id);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

router.post('/users/:id/credits', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const { delta, reason } = req.body || {};
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return res.status(400).json({ error: '请输入有效额度变动' });
  const newBalance = changeCredits(u.id, d, reason || (d > 0 ? '管理员充值' : '管理员扣减'));
  res.json({ credits: newBalance });
});

// ---------------- Projects ----------------
router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
  const list = rows.map((p) => {
    const u = db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(p.user_id);
    const d = projectDetail(p.id);
    return {
      id: p.id,
      user: u ? u.display_name : null,
      username: u ? u.username : null,
      reference_name: d.reference ? d.reference.name : null,
      status: p.status,
      current_stage: p.current_stage,
      created_at: p.created_at,
      cover: d.final ? d.final.url : d.selected_wash ? d.selected_wash.url : d.reference ? d.reference.url : null,
    };
  });
  res.json({ projects: list });
});

router.get('/projects/:id', (req, res) => {
  const d = projectDetail(req.params.id);
  if (!d) return res.status(404).json({ error: '项目不存在' });
  res.json(d);
});

// ---------------- AI Tasks ----------------
router.get('/tasks', (req, res) => {
  const { status, workflow_type } = req.query;
  let sql = 'SELECT * FROM ai_tasks';
  const conds = [];
  const args = [];
  if (status) { conds.push('status = ?'); args.push(status); }
  if (workflow_type) { conds.push('workflow_type = ?'); args.push(workflow_type); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY id DESC LIMIT 200';
  const rows = db.prepare(sql).all(...args);
  const list = rows.map((t) => {
    const u = t.user_id ? db.prepare('SELECT display_name FROM users WHERE id = ?').get(t.user_id) : null;
    return { ...taskView(t), user: u ? u.display_name : null, project_id: t.project_id };
  });
  res.json({ tasks: list });
});

router.get('/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM ai_tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  res.json({ task: taskView(t) });
});

router.post('/tasks/:id/rerun', asyncHandler(async (req, res) => {
  const t = db.prepare('SELECT * FROM ai_tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  const inputs = safeJson(t.inputs_json, {});
  const parameters = (req.body || {}).parameters || {};
  const processing = { wash: 'washing', faceswap: 'faceswapping', enhance: 'enhancing' };
  const newTask = await startTask({
    workflowType: t.workflow_type,
    projectId: t.is_test ? null : t.project_id,
    userId: t.is_test ? null : t.user_id,
    inputs,
    overrideParams: parameters,
    isTest: !!t.is_test,
    chargeCredits: false,
  });
  if (!t.is_test && t.project_id) {
    db.prepare('UPDATE projects SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      processing[t.workflow_type] || 'washing',
      t.project_id
    );
  }
  res.status(201).json({ task: taskView(newTask) });
}));

// ---------------- Workflows ----------------
router.get('/workflows', (req, res) => {
  const rows = db.prepare('SELECT * FROM workflow_configs ORDER BY id').all();
  res.json({
    workflows: rows.map((r) => ({
      type: r.workflow_type,
      name: r.name,
      enabled: !!r.enabled,
      credit_cost: r.credit_cost,
      prompt: r.prompt,
      negative_prompt: r.negative_prompt,
      updated_by: r.updated_by,
      updated_at: r.updated_at,
      adminParams: safeJson(r.params_json, {}),
      effectiveParams: resolveParams(r.workflow_type),
    })),
  });
});

router.get('/workflows/:type', (req, res) => {
  const { type } = req.params;
  if (!WORKFLOW_TYPES.includes(type)) return res.status(404).json({ error: 'Workflow 不存在' });
  const cfg = getWorkflowConfig(type);
  const sys = defaults.workflows[type];
  const changelog = db
    .prepare('SELECT * FROM param_changelogs WHERE workflow_type = ? ORDER BY id DESC LIMIT 20')
    .all(type);
  res.json({
    type,
    name: cfg ? cfg.name : sys.name,
    enabled: cfg ? !!cfg.enabled : true,
    prompt: cfg ? cfg.prompt : sys.prompt,
    negative_prompt: cfg ? cfg.negative_prompt : sys.negative_prompt,
    credit_cost: cfg ? cfg.credit_cost : sys.credit_cost,
    updated_by: cfg ? cfg.updated_by : null,
    updated_at: cfg ? cfg.updated_at : null,
    systemDefaults: sys,
    adminParams: cfg ? safeJson(cfg.params_json, {}) : {},
    effectiveParams: resolveParams(type),
    schema: getSchema(type).fields,
    changelog,
  });
});

function recordChange(type, field, oldVal, newVal, by) {
  if (oldVal === newVal) return;
  db.prepare(
    'INSERT INTO param_changelogs (workflow_type, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)'
  ).run(type, field, oldVal == null ? null : String(oldVal), newVal == null ? null : String(newVal), by || 'admin');
}

router.put('/workflows/:type', (req, res) => {
  const { type } = req.params;
  if (!WORKFLOW_TYPES.includes(type)) return res.status(404).json({ error: 'Workflow 不存在' });
  const body = req.body || {};
  const params = body.params || {};
  const v = validateParams(type, params);
  if (!v.ok) return res.status(400).json({ error: v.errors.join('；') });
  const cfg = getWorkflowConfig(type);
  const by = (req.user && req.user.username) || 'admin';
  const oldParams = cfg ? safeJson(cfg.params_json, {}) : {};
  const enabled = body.enabled == null ? (cfg ? cfg.enabled : 1) : body.enabled ? 1 : 0;
  const prompt = body.prompt == null ? (cfg ? cfg.prompt : defaults.workflows[type].prompt) : body.prompt;
  const negative_prompt =
    body.negative_prompt == null ? (cfg ? cfg.negative_prompt : defaults.workflows[type].negative_prompt) : body.negative_prompt;
  const credit_cost = body.credit_cost == null ? (cfg ? cfg.credit_cost : defaults.workflows[type].credit_cost) : Number(body.credit_cost);

  if (cfg) {
    db.prepare(
      `UPDATE workflow_configs SET enabled = ?, prompt = ?, negative_prompt = ?, params_json = ?, credit_cost = ?, updated_by = ?, updated_at = datetime('now')
       WHERE workflow_type = ?`
    ).run(enabled, prompt, negative_prompt, JSON.stringify(params), credit_cost, by, type);
  } else {
    db.prepare(
      `INSERT INTO workflow_configs (workflow_type, name, enabled, prompt, negative_prompt, params_json, credit_cost, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(type, defaults.workflows[type].name, enabled, prompt, negative_prompt, JSON.stringify(params), credit_cost, by);
  }

  if (cfg) {
    recordChange(type, 'prompt', cfg.prompt, prompt, by);
    recordChange(type, 'negative_prompt', cfg.negative_prompt, negative_prompt, by);
    for (const [k, val] of Object.entries(params)) {
      if (oldParams[k] !== val) recordChange(type, k, oldParams[k], val, by);
    }
  }

  res.json({ ok: true, effectiveParams: resolveParams(type) });
});

router.post('/workflows/:type/reset', (req, res) => {
  const { type } = req.params;
  if (!WORKFLOW_TYPES.includes(type)) return res.status(404).json({ error: 'Workflow 不存在' });
  const def = defaults.workflows[type];
  const by = (req.user && req.user.username) || 'admin';
  const cfg = getWorkflowConfig(type);
  if (cfg) {
    db.prepare(
      `UPDATE workflow_configs SET prompt = ?, negative_prompt = ?, params_json = ?, credit_cost = ?, updated_by = ?, updated_at = datetime('now')
       WHERE workflow_type = ?`
    ).run(def.prompt, def.negative_prompt, JSON.stringify(def.params), def.credit_cost, by, type);
    recordChange(type, 'prompt', cfg.prompt, def.prompt, by);
    recordChange(type, 'negative_prompt', cfg.negative_prompt, def.negative_prompt, by);
  }
  res.json({ ok: true, effectiveParams: resolveParams(type) });
});

// 测试生成：不扣额度、不关联项目
router.post('/workflows/:type/test', asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!WORKFLOW_TYPES.includes(type)) return res.status(404).json({ error: 'Workflow 不存在' });
  const body = req.body || {};
  const inputs = body.inputs || {};
  const parameters = body.parameters || {};
  let rel;
  if (type === 'wash') {
    const ref = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(inputs.referenceImageId);
    if (!ref) return res.status(400).json({ error: '请选择测试参考照片' });
    rel = { referenceImage: ref.file_path };
  } else if (type === 'faceswap') {
    const face = db.prepare('SELECT * FROM images WHERE id = ?').get(inputs.faceImageId);
    const target = db.prepare('SELECT * FROM images WHERE id = ?').get(inputs.targetImageId);
    if (!face || !target) return res.status(400).json({ error: '请选择测试人脸图和目标图' });
    rel = { faceImage: face.file_path, targetImage: target.file_path };
  } else {
    const img = db.prepare('SELECT * FROM images WHERE id = ?').get(inputs.imageId);
    if (!img) return res.status(400).json({ error: '请选择测试图片' });
    rel = { image: img.file_path };
  }
  const task = await startTask({ workflowType: type, inputs: rel, overrideParams: parameters, isTest: true, chargeCredits: false });
  res.status(201).json({ task: taskView(task) });
}));

// 图片列表（供测试选择）
router.get('/images', (req, res) => {
  const { kind } = req.query;
  let sql = 'SELECT * FROM images';
  const args = [];
  if (kind) { sql += ' WHERE kind = ?'; args.push(kind); }
  sql += ' ORDER BY id DESC LIMIT 100';
  const rows = db.prepare(sql).all(...args);
  res.json({
    images: rows.map((r) => {
      const u = r.user_id ? db.prepare('SELECT display_name FROM users WHERE id = ?').get(r.user_id) : null;
      return { ...imageView(r), project_id: r.project_id, user: u ? u.display_name : null };
    }),
  });
});

// ---------------- Reference Images ----------------
const refUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.REFERENCES_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `ref-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

router.get('/references', (req, res) => {
  const rows = db.prepare('SELECT * FROM reference_images ORDER BY sort_order DESC, id DESC').all();
  res.json({ references: rows.map((r) => ({ ...r, url: relToUrl(r.file_path) })) });
});

router.post('/references', refUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传参考照片' });
  const { name, category = '其他', sort_order = 0, status = 'active' } = req.body || {};
  if (!name) return res.status(400).json({ error: '请填写名称' });
  const info = db
    .prepare(
      'INSERT INTO reference_images (name, category, sort_order, status, file_path) VALUES (?, ?, ?, ?, ?)'
    )
    .run(String(name), String(category), Number(sort_order) || 0, status === 'hidden' ? 'hidden' : 'active', toRel(req.file.path));
  const row = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ ...row, url: relToUrl(row.file_path) });
});

router.patch('/references/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: '参考照片不存在' });
  const { name, category, sort_order, status } = req.body || {};
  db.prepare('UPDATE reference_images SET name = ?, category = ?, sort_order = ?, status = ? WHERE id = ?').run(
    name ?? r.name,
    category ?? r.category,
    sort_order != null ? Number(sort_order) : r.sort_order,
    status === 'hidden' ? 'hidden' : status === 'active' ? 'active' : r.status,
    r.id
  );
  const row = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(r.id);
  res.json({ ...row, url: relToUrl(row.file_path) });
});

router.delete('/references/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: '参考照片不存在' });
  db.prepare("UPDATE reference_images SET status = 'hidden' WHERE id = ?").run(r.id);
  res.json({ ok: true });
});

// ---------------- Credits ----------------
router.get('/credits', (req, res) => {
  const users = db.prepare("SELECT id, username, display_name, credits, status FROM users WHERE role = 'user' ORDER BY id DESC").all();
  res.json({ users, transactions: allTransactions().slice(0, 200) });
});

router.get('/transactions', (req, res) => {
  res.json({ transactions: allTransactions().slice(0, 500) });
});

// ---------------- Settings ----------------
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  const workflows = db.prepare('SELECT workflow_type, name, enabled, credit_cost FROM workflow_configs ORDER BY id').all();
  res.json({ settings, workflows });
});

router.put('/settings', (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: '无效设置' });
  for (const [k, v] of Object.entries(settings)) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
  }
  res.json({ ok: true });
});

module.exports = router;
