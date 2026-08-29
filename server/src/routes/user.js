const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../auth');
const { asyncHandler, relToUrl, toRel, safeJson } = require('../util');
const { projectDetail, taskView } = require('../services');
const { startTask, TYPE_LABEL } = require('../aiService');
const { getCreditCost } = require('../params');
const { transactionsFor } = require('../credits');

const router = express.Router();
router.use(requireAuth);

// 用户端可见的 Workflow 信息（仅名称 + 额度消耗，不含敏感参数）
router.get('/workflows', (req, res) => {
  const rows = db.prepare('SELECT workflow_type, name, enabled, credit_cost FROM workflow_configs ORDER BY id').all();
  res.json({
    workflows: rows.map((r) => ({
      type: r.workflow_type,
      name: r.name,
      enabled: !!r.enabled,
      creditCost: r.credit_cost ?? getCreditCost(r.workflow_type),
    })),
  });
});

// ---------- 参考照片 ----------
router.get('/references', (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    rows = db.prepare("SELECT * FROM reference_images WHERE status = 'active' AND category = ? ORDER BY sort_order DESC, id DESC").all(category);
  } else {
    rows = db.prepare("SELECT * FROM reference_images WHERE status = 'active' ORDER BY sort_order DESC, id DESC").all();
  }
  const categories = db.prepare("SELECT DISTINCT category FROM reference_images WHERE status = 'active' ORDER BY category").all().map((r) => r.category);
  res.json({
    categories,
    references: rows.map((r) => ({ ...r, url: relToUrl(r.file_path) })),
  });
});

router.get('/references/:id', (req, res) => {
  const r = db.prepare("SELECT * FROM reference_images WHERE id = ? AND status = 'active'").get(req.params.id);
  if (!r) return res.status(404).json({ error: '参考照片不存在' });
  res.json({ ...r, url: relToUrl(r.file_path) });
});

// ---------- 项目 ----------
router.post('/projects', (req, res) => {
  const { referenceImageId } = req.body || {};
  let ref = null;
  if (referenceImageId) {
    ref = db.prepare("SELECT * FROM reference_images WHERE id = ? AND status = 'active'").get(referenceImageId);
    if (!ref) return res.status(404).json({ error: '参考照片不存在或已下架' });
  }
  const info = db
    .prepare(
      "INSERT INTO projects (user_id, reference_image_id, status, current_stage) VALUES (?, ?, 'ready', 'reference')"
    )
    .run(req.user.id, ref ? ref.id : null);
  res.status(201).json(projectDetail(Number(info.lastInsertRowid)));
});

router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const list = rows.map((p) => {
    const detail = projectDetail(p.id);
    const cover =
      detail.final || (detail.enhance[0]) || (detail.faceswap[0]) || detail.selected_wash || (detail.wash[0]) || detail.reference;
    return {
      id: p.id,
      status: p.status,
      current_stage: p.current_stage,
      created_at: p.created_at,
      cover: cover ? cover.url : null,
      reference_name: detail.reference ? detail.reference.name : null,
    };
  });
  res.json({ projects: list });
});

function loadOwnProject(req, res) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!p) {
    res.status(404).json({ error: '项目不存在' });
    return null;
  }
  return p;
}

router.get('/projects/:id', (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  res.json(projectDetail(p.id));
});

// ---------- 上传本人照片 ----------
const faceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.FACES_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `face-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

router.post('/projects/:id/face', faceUpload.single('face'), (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  if (!req.file) return res.status(400).json({ error: '请上传照片' });
  const rel = toRel(req.file.path);
  db.prepare('INSERT INTO images (project_id, user_id, kind, file_path) VALUES (?, ?, ?, ?)').run(
    p.id,
    req.user.id,
    'face',
    rel
  );
  db.prepare("UPDATE projects SET current_stage = 'face', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.json(projectDetail(p.id));
});

// ---------- 上传参考照片（用户自己上传） ----------
const referenceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.REFERENCES_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `userref-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

router.post('/projects/:id/reference', referenceUpload.single('reference'), (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  if (!req.file) return res.status(400).json({ error: '请上传参考照片' });
  const rel = toRel(req.file.path);
  db.prepare("INSERT INTO images (project_id, user_id, kind, file_path) VALUES (?, ?, 'reference', ?)").run(
    p.id,
    req.user.id,
    rel
  );
  db.prepare("UPDATE projects SET current_stage = 'reference', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.json(projectDetail(p.id));
});

// ---------- 发起洗图 ----------
router.post('/projects/:id/wash', asyncHandler(async (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  // 参考图来源：用户自己上传的参考照片优先，其次后台配置的参考照片
  const userRef = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'reference' ORDER BY id DESC LIMIT 1").get(p.id);
  let refFile = null;
  if (userRef) {
    refFile = userRef.file_path;
  } else if (p.reference_image_id) {
    const ref = db.prepare('SELECT * FROM reference_images WHERE id = ?').get(p.reference_image_id);
    if (!ref) return res.status(400).json({ error: '参考照片不存在' });
    refFile = ref.file_path;
  } else {
    return res.status(400).json({ error: '请先上传参考照片' });
  }

  const task = await startTask({
    workflowType: 'wash',
    projectId: p.id,
    userId: req.user.id,
    inputs: { referenceImage: refFile },
    overrideParams: {},
  });
  db.prepare("UPDATE projects SET status = 'washing', current_stage = 'wash', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.status(201).json({ task: taskView(task), project: projectDetail(p.id) });
}));

// ---------- 选择洗图候选 ----------
router.post('/projects/:id/select-wash', (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  const { imageId } = req.body || {};
  if (!imageId) return res.status(400).json({ error: '请选择一张候选图' });
  const img = db.prepare("SELECT * FROM images WHERE id = ? AND project_id = ? AND kind = 'wash'").get(imageId, p.id);
  if (!img) return res.status(404).json({ error: '候选图不存在' });
  db.prepare("UPDATE images SET selected = 0 WHERE project_id = ? AND kind = 'wash'").run(p.id);
  db.prepare('UPDATE images SET selected = 1 WHERE id = ?').run(img.id);
  db.prepare("UPDATE projects SET status = 'ready_for_faceswap', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.json(projectDetail(p.id));
});

// ---------- 发起换脸 ----------
router.post('/projects/:id/faceswap', asyncHandler(async (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  const face = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'face' ORDER BY id DESC LIMIT 1").get(p.id);
  const target = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'wash' AND selected = 1").get(p.id);
  if (!face) return res.status(400).json({ error: '请先上传本人照片' });
  if (!target) return res.status(400).json({ error: '请先选择一张洗图候选' });

  const task = await startTask({
    workflowType: 'faceswap',
    projectId: p.id,
    userId: req.user.id,
    inputs: { faceImage: face.file_path, targetImage: target.file_path },
  });
  db.prepare("UPDATE projects SET status = 'faceswapping', current_stage = 'faceswap', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.status(201).json({ task: taskView(task), project: projectDetail(p.id) });
}));

// ---------- 发起质感优化 ----------
router.post('/projects/:id/enhance', asyncHandler(async (req, res) => {
  const p = loadOwnProject(req, res);
  if (!p) return;
  const fsImage = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'faceswap' ORDER BY id DESC LIMIT 1").get(p.id);
  if (!fsImage) return res.status(400).json({ error: '尚未完成换脸' });

  const task = await startTask({
    workflowType: 'enhance',
    projectId: p.id,
    userId: req.user.id,
    inputs: { image: fsImage.file_path },
  });
  db.prepare("UPDATE projects SET status = 'enhancing', current_stage = 'enhance', updated_at = datetime('now') WHERE id = ?").run(p.id);
  res.status(201).json({ task: taskView(task), project: projectDetail(p.id) });
}));

// ---------- 任务状态（用户查看自己的） ----------
router.get('/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM ai_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  res.json({ task: taskView(t) });
});

// ---------- 账号 / 额度 ----------
router.get('/account/me', (req, res) => {
  const counts = {
    projects: db.prepare('SELECT COUNT(*) c FROM projects WHERE user_id = ?').get(req.user.id).c,
    wash: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'wash'").get(req.user.id).c,
    faceswap: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'faceswap'").get(req.user.id).c,
    enhance: db.prepare("SELECT COUNT(*) c FROM ai_tasks WHERE user_id = ? AND workflow_type = 'enhance'").get(req.user.id).c,
  };
  const spent = db.prepare('SELECT COALESCE(SUM(-delta),0) s FROM credit_transactions WHERE user_id = ? AND delta < 0').get(req.user.id).s;
  res.json({
    id: req.user.id,
    username: req.user.username,
    display_name: req.user.display_name,
    credits: req.user.credits,
    created_at: req.user.created_at,
    stats: counts,
    total_spent: spent,
  });
});

router.get('/account/transactions', (req, res) => {
  res.json({ transactions: transactionsFor(req.user.id) });
});

module.exports = router;
