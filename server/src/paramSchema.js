// 每个 Workflow 开放给管理员调整的参数定义（用于后台表单渲染 + 校验）
// prompt / negative_prompt 由 Workflow 详情页的专用卡片处理，不在此列。
// type: textarea | number | select | slider | switch | seed
const SCHEMA = {
  wash: {
    fields: [
      { key: 'candidateCount', label: '候选图数量', type: 'select', options: [2, 4, 6, 8] },
      { key: 'denoise', label: '重绘强度', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'outputResolution', label: '输出边长（最长边）', type: 'number', min: 512, max: 4096, advanced: true },
      { key: 'steps', label: '生成步数', type: 'number', min: 1, max: 50, advanced: true },
      { key: 'cfg', label: '提示词强度', type: 'number', min: 0, max: 10, step: 0.1, advanced: true },
      { key: 'seed', label: '随机种子', type: 'seed', advanced: true },
    ],
  },
  faceswap: {
    fields: [
      { key: 'faceStrength', label: '人脸相似度', type: 'slider', min: 0, max: 2, step: 0.01 },
      { key: 'denoise', label: '重绘强度', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'outputResolution', label: '输出分辨率', type: 'select', options: [1024, 2048, 4096], advanced: true },
      { key: 'steps', label: '生成步数', type: 'number', min: 1, max: 100, advanced: true },
      { key: 'cfg', label: '提示词强度', type: 'number', min: 0, max: 30, step: 0.1, advanced: true },
      { key: 'seed', label: '随机种子', type: 'seed', advanced: true },
    ],
  },
  enhance: {
    fields: [
      { key: 'outputResolution', label: '输出分辨率', type: 'select', options: [2048, 4096] },
      { key: 'colorCorrection', label: '色彩校正', type: 'select', options: ['lab', 'off'] },
      { key: 'batchSize', label: '批处理大小', type: 'number', min: 1, max: 16, advanced: true },
      { key: 'overlapRate', label: '分块重叠率', type: 'number', min: 0, max: 1, step: 0.01, advanced: true },
      { key: 'seed', label: '随机种子', type: 'seed', advanced: true },
    ],
  },
};

function getSchema(type) {
  return SCHEMA[type] || { fields: [] };
}

function validateParams(type, params = {}) {
  const { fields } = getSchema(type);
  const errors = [];
  for (const f of fields) {
    if (f.key === 'seed') continue;
    if (!(f.key in params)) continue;
    const v = params[f.key];
    if (f.type === 'select') {
      if (!f.options.includes(v)) errors.push(`${f.label} 取值不合法`);
    } else if (f.type === 'number' || f.type === 'slider') {
      if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${f.label} 必须是数字`);
      else if (f.min != null && v < f.min) errors.push(`${f.label} 不能小于 ${f.min}`);
      else if (f.max != null && v > f.max) errors.push(`${f.label} 不能大于 ${f.max}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { getSchema, validateParams };
