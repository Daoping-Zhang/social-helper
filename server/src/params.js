const db = require('./db');
const defaults = require('./defaults');

function getWorkflowConfig(type) {
  return db.prepare('SELECT * FROM workflow_configs WHERE workflow_type = ?').get(type);
}

// 解析最终参数：System Default <- Admin Config <- Task Override
function resolveParams(type, override = {}) {
  const def = defaults.workflows[type];
  const base = def ? JSON.parse(JSON.stringify(def.params)) : {};
  const cfg = getWorkflowConfig(type);
  if (cfg && cfg.params_json) {
    try {
      Object.assign(base, JSON.parse(cfg.params_json));
    } catch (_) {
      /* ignore malformed params */
    }
  }
  Object.assign(base, override || {});
  return base;
}

function getCreditCost(type) {
  const cfg = getWorkflowConfig(type);
  if (cfg && typeof cfg.credit_cost === 'number' && cfg.credit_cost >= 0) {
    return cfg.credit_cost;
  }
  return defaults.workflows[type] ? defaults.workflows[type].credit_cost : 0;
}

function getPrompt(type) {
  const cfg = getWorkflowConfig(type);
  if (cfg) return cfg.prompt || '';
  return defaults.workflows[type] ? defaults.workflows[type].prompt || '' : '';
}

function getNegativePrompt(type) {
  const cfg = getWorkflowConfig(type);
  if (cfg) return cfg.negative_prompt || '';
  return defaults.workflows[type] ? defaults.workflows[type].negative_prompt || '' : '';
}

function isWorkflowEnabled(type) {
  const cfg = getWorkflowConfig(type);
  if (cfg) return !!cfg.enabled;
  return true;
}

module.exports = {
  getWorkflowConfig,
  resolveParams,
  getCreditCost,
  getPrompt,
  getNegativePrompt,
  isWorkflowEnabled,
};
