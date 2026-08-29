const db = require('./db');
const { relToUrl, safeJson } = require('./util');

function imageView(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    url: relToUrl(row.file_path),
    selected: !!row.selected,
    created_at: row.created_at,
  };
}

function taskView(row) {
  if (!row) return null;
  return {
    id: row.id,
    workflow_type: row.workflow_type,
    status: row.status,
    error: row.error,
    credit_cost: row.credit_cost,
    is_test: !!row.is_test,
    inputs: safeJson(row.inputs_json, {}),
    params: safeJson(row.params_json, {}),
    result: safeJson(row.result_json, {}),
    external_task_id: row.external_task_id,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

function projectDetail(id) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return null;
  const reference = project.reference_image_id
    ? db.prepare('SELECT id, name, category, file_path FROM reference_images WHERE id = ?').get(project.reference_image_id)
    : null;
  if (reference) reference.url = relToUrl(reference.file_path);

  const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(project.user_id);

  const userRef = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'reference' ORDER BY id DESC LIMIT 1").get(id);
  const face = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'face' ORDER BY id DESC LIMIT 1").get(id);
  const wash = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'wash' ORDER BY id").all(id);
  const selectedWash = wash.find((w) => w.selected) || null;
  const faceswap = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'faceswap' ORDER BY id DESC").all(id);
  const enhance = db.prepare("SELECT * FROM images WHERE project_id = ? AND kind = 'enhance' ORDER BY id DESC").all(id);

  const tasks = db.prepare('SELECT * FROM ai_tasks WHERE project_id = ? ORDER BY id DESC').all(id).map(taskView);

  return {
    id: project.id,
    user_id: project.user_id,
    user: user ? user.display_name : null,
    status: project.status,
    current_stage: project.current_stage,
    created_at: project.created_at,
    updated_at: project.updated_at,
    reference,
    user_reference: imageView(userRef),
    face: imageView(face),
    wash: wash.map(imageView),
    selected_wash: imageView(selectedWash),
    faceswap: faceswap.map(imageView),
    enhance: enhance.map(imageView),
    final: enhance.length ? imageView(enhance[0]) : null,
    tasks,
  };
}

module.exports = { imageView, taskView, projectDetail };
