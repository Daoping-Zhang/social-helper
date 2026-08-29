const db = require('./db');
const { getProvider } = require('./ai');
const { resolveParams, getCreditCost, isWorkflowEnabled, getPrompt, getNegativePrompt } = require('./params');
const { changeCredits } = require('./credits');
const { absPath, toRel, relToUrl } = require('./util');

const TYPE_LABEL = { wash: 'Wash', faceswap: 'Face Swap', enhance: 'Enhance' };

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// 启动一次 AI 任务
// inputs 为「相对 DATA_DIR 的路径」；provider 需要绝对路径
async function startTask({ workflowType, projectId = null, userId = null, inputs = {}, overrideParams = {}, isTest = false, chargeCredits = true }) {  if (!isWorkflowEnabled(workflowType)) {
    throw httpError(400, `${TYPE_LABEL[workflowType]} Workflow 已停用，请联系管理员`);
  }

  const cost = getCreditCost(workflowType);
  if (chargeCredits && !isTest && userId) {
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
    if (!user || user.credits < cost) {
      throw httpError(402, '额度不足，请联系管理员');
    }
  }

  const params = resolveParams(workflowType, overrideParams);
  // 注入 prompt / negative_prompt（来自管理员配置，未在 override 中指定时使用）
  if (params.prompt === undefined) params.prompt = getPrompt(workflowType);
  if (params.negative_prompt === undefined) params.negative_prompt = getNegativePrompt(workflowType);

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO ai_tasks (project_id, user_id, workflow_type, status, inputs_json, params_json, credit_cost, is_test, created_at, started_at)
       VALUES (?, ?, ?, 'running', ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(projectId, userId, workflowType, JSON.stringify(inputs), JSON.stringify(params), cost, isTest ? 1 : 0);
  const taskId = Number(info.lastInsertRowid);

  const absInputs = {};
  for (const [k, v] of Object.entries(inputs)) {
    absInputs[k] = absPath(v);
  }

  try {
    const provider = getProvider();
    const { externalTaskId } = await provider.submitWorkflow({
      workflowType,
      inputs: absInputs,
      parameters: params,
    });
    db.prepare('UPDATE ai_tasks SET external_task_id = ? WHERE id = ?').run(externalTaskId, taskId);
  } catch (err) {
    db.prepare("UPDATE ai_tasks SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?").run(
      String(err.message || err),
      taskId
    );
    if (projectId) {
      db.prepare("UPDATE projects SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(projectId);
    }
    throw httpError(500, 'AI 提交失败：' + (err.message || err));
  }

  if (chargeCredits && !isTest && userId && cost > 0) {
    changeCredits(userId, -cost, `${TYPE_LABEL[workflowType]} 消耗`, { projectId, taskId });
  }

  return db.prepare('SELECT * FROM ai_tasks WHERE id = ?').get(taskId);
}

function _onSuccess(task, images) {
  const urls = images.map((img) => relToUrl(toRel(img.path)));
  db.prepare(
    "UPDATE ai_tasks SET status = 'success', result_json = ?, completed_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify({ images: urls.map((u) => ({ url: u })) }), task.id);

  if (!task.is_test && task.project_id) {
    const kind = task.workflow_type; // wash / faceswap / enhance
    const ins = db.prepare(
      'INSERT INTO images (project_id, user_id, kind, file_path, selected) VALUES (?, ?, ?, ?, 0)'
    );
    for (const img of images) {
      ins.run(task.project_id, task.user_id, kind, toRel(img.path));
    }
    const stage =
      task.workflow_type === 'wash'
        ? 'awaiting_selection'
        : task.workflow_type === 'faceswap'
          ? 'awaiting_enhance'
          : 'completed';
    const status = stage;
    db.prepare(
      "UPDATE projects SET status = ?, current_stage = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, task.workflow_type, task.project_id);
  }
}

function _onFailed(task, error) {
  db.prepare(
    "UPDATE ai_tasks SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
  ).run(error || '未知错误', task.id);
  if (!task.is_test && task.project_id) {
    db.prepare("UPDATE projects SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(task.project_id);
  }
}

async function poll() {
  // 只轮询已成功提交到 RunningHub 的任务（external_task_id 已写入），
  // 避免在任务提交中（external_task_id 还是 NULL）时误查询
  const running = db.prepare("SELECT * FROM ai_tasks WHERE status = 'running' AND external_task_id IS NOT NULL").all();
  if (!running.length) return;
  const provider = getProvider();
  for (const task of running) {
    try {
      const res = await provider.getTaskStatus(task.external_task_id, { workflowType: task.workflow_type });
      if (res.status === 'success') {
        _onSuccess(task, res.images || []);
      } else if (res.status === 'failed') {
        _onFailed(task, res.error);
      }
    } catch (err) {
      _onFailed(task, String(err.message || err));
    }
  }
}

function startPolling(intervalMs = 2000) {
  // 启动时清理上次进程遗留的 running 任务
  const orphan = db.prepare("SELECT * FROM ai_tasks WHERE status = 'running' AND external_task_id IS NOT NULL").all();
  (async () => {
    for (const t of orphan) {
      const provider = getProvider();
      try {
        const res = await provider.getTaskStatus(t.external_task_id, { workflowType: t.workflow_type });
        if (res.status === 'success') _onSuccess(t, res.images || []);
        else if (res.status === 'failed') _onFailed(t, res.error);
        // 若仍是 running，交给轮询
      } catch (_) {
        /* leave running */
      }
    }
  })();
  setInterval(poll, intervalMs);
  return { poll };
}

module.exports = { startTask, poll, startPolling, TYPE_LABEL };
