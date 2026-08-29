const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const MAPPING = require('./workflowMapping');

// RunningHub ComfyUI 工作流 Provider（经典 ComfyUI API）
// 端点依据官方文档：
//   上传   POST /openapi/v2/media/upload/binary        (Authorization: Bearer <apiKey>, multipart "file")
//   提交   POST /task/openapi/create                    (apiKey + workflowId + nodeInfoList)
//   状态   POST /task/openapi/status                    (apiKey + taskId)  -> data 为状态字符串
//   结果   POST /task/openapi/outputs                   (apiKey + taskId)  -> data 为 [{fileUrl, nodeId, ...}]
//
// 注意：
//   - taskId 为 int64，必须按字符串处理（JSON 中可能超 Number 精度）。
//   - 洗图「多候选」由 workflow 内的 RepeatLatentBatch.amount（node 206）控制，一次提交即产 N 张。
class RunningHubProvider {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey ?? config.RH_API_KEY ?? '';
    this.baseUrl = (opts.baseUrl ?? config.RH_BASE_URL ?? 'https://www.runninghub.cn').replace(/\/+$/, '');
    this.workflowIds = opts.workflowIds ?? {
      wash: config.RH_WORKFLOW_ID_WASH || '',
      faceswap: config.RH_WORKFLOW_ID_FACESWAP || '',
      enhance: config.RH_WORKFLOW_ID_ENHANCE || '',
    };
    this.outputDir = config.GENERATED_DIR;
  }

  _assertConfigured(workflowType) {
    if (!this.apiKey) throw new Error('未配置 RH_API_KEY（RunningHub API Key）');
    if (!this.workflowIds[workflowType]) {
      throw new Error(`未配置 ${workflowType} 对应的 workflowId（RH_WORKFLOW_ID_${workflowType.toUpperCase()}）`);
    }
  }

  _headers(json = true) {
    const h = { Authorization: `Bearer ${this.apiKey}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async _post(p, body) {
    const res = await fetch(this.baseUrl + p, {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, json };
  }

  // 上传本地图片，返回 RunningHub 的 fileName（用于 LoadImage 节点 image 字段）
  // 使用经典上传接口 /task/openapi/upload（apiKey 放在 form 中），返回 "api/xxx" 前缀，
  // 该前缀可直接用于 LoadImage 节点；v2 上传返回的 "openapi/xxx" 前缀不适用。
  async uploadImage(absPath) {
    const buf = fs.readFileSync(absPath);
    const ext = (path.extname(absPath) || '.png').toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    const form = new FormData();
    form.append('apiKey', this.apiKey);
    form.append('file', new Blob([buf], { type: mime }), 'input' + ext);
    form.append('fileType', 'image');
    const res = await fetch(this.baseUrl + '/task/openapi/upload', {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (json.code !== 0 || !json.data || !json.data.fileName) {
      throw new Error('RunningHub 上传失败: ' + (json.msg || json.message || JSON.stringify(json)));
    }
    return json.data.fileName;
  }

  // 由产品参数构造 nodeInfoList
  _buildNodeInfoList(workflowType, fileNames, parameters) {
    const m = MAPPING[workflowType];
    const list = [];
    const set = (nodeId, fieldName, value) => {
      if (value === undefined || value === null || value === '') return;
      list.push({ nodeId: String(nodeId), fieldName, fieldValue: value });
    };

    if (workflowType === 'wash') {
      set(m.image, 'image', fileNames.referenceImage);
      if (typeof parameters.seed === 'number') set(m.seed, 'seed', parameters.seed);
      if (parameters.steps !== undefined) set(m.steps, 'steps', parameters.steps);
      if (parameters.cfg !== undefined) set(m.cfg, 'cfg', parameters.cfg);
      if (parameters.denoise !== undefined) set(m.denoise, 'value', parameters.denoise);
      if (parameters.candidateCount !== undefined) set(m.candidateCount, 'value', parameters.candidateCount);
      if (parameters.outputResolution !== undefined) set(m.scaleToLength, 'value', parameters.outputResolution);
      if (parameters.prompt) set(m.prompt, 'text_input', parameters.prompt); // 留空 => Florence2 自动打标
    } else if (workflowType === 'faceswap') {
      set(m.imageIdentity, 'image', fileNames.faceImage);
      set(m.imageTarget, 'image', fileNames.targetImage);
      if (parameters.prompt !== undefined) set(m.prompt, 'text', parameters.prompt);
      if (parameters.negative_prompt !== undefined) set(m.negative, 'text', parameters.negative_prompt);
      if (typeof parameters.seed === 'number') set(m.seed, 'seed', parameters.seed);
      if (parameters.steps !== undefined) set(m.steps, 'steps', parameters.steps);
      if (parameters.cfg !== undefined) set(m.cfg, 'cfg', parameters.cfg);
      if (parameters.denoise !== undefined) set(m.denoise, 'denoise', parameters.denoise);
      if (parameters.faceStrength !== undefined) set(m.faceStrength, 'weight', parameters.faceStrength);
      if (parameters.outputResolution !== undefined) set(m.outputResolution, 'value', parameters.outputResolution);
      // 修复工作流 node 123 里 attention_mode 被存成 false 的问题（需为 sdpa 等合法值）
      if (m.attentionMode) set(m.attentionMode, 'attention_mode', 'sdpa');
    } else if (workflowType === 'enhance') {
      set(m.image, 'image', fileNames.image);
      if (typeof parameters.seed === 'number') set(m.seed, 'seed', parameters.seed);
      if (parameters.outputResolution !== undefined) set(m.outputResolution, 'value', parameters.outputResolution);
      if (parameters.batchSize !== undefined) set(m.batchSize, 'batch_size', parameters.batchSize);
      // SeedVR2 关闭色彩校正的枚举值未确认，'off' 时不覆盖（保持工作流默认）
      if (parameters.colorCorrection && parameters.colorCorrection !== 'off') {
        set(m.colorCorrection, 'color_correction', parameters.colorCorrection);
      }
      if (parameters.overlapRate !== undefined) set(m.overlapRate, 'overlap_rate', parameters.overlapRate);
    }
    return list;
  }

  async _submitOne(workflowType, fileNames, parameters) {
    this._assertConfigured(workflowType);
    const nodeInfoList = this._buildNodeInfoList(workflowType, fileNames, parameters);
    const body = { apiKey: this.apiKey, workflowId: this.workflowIds[workflowType], nodeInfoList };
    const { json } = await this._post('/task/openapi/create', body);
    if (json.code !== 0 || !json.data || json.data.taskId == null) {
      throw new Error('RunningHub 提交失败: ' + (json.msg || json.message || JSON.stringify(json)));
    }
    return String(json.data.taskId);
  }

  async submitWorkflow({ workflowType, inputs, parameters }) {
    this._assertConfigured(workflowType);
    // 1) 上传输入图
    const fileNames = {};
    for (const [k, v] of Object.entries(inputs)) {
      fileNames[k] = await this.uploadImage(v);
    }
    // 2) 单次提交（洗图的多候选由 workflow 内 RepeatLatentBatch 控制）
    const externalTaskId = await this._submitOne(workflowType, fileNames, parameters);
    return { externalTaskId };
  }

  _parseIds(id) {
    try { const a = JSON.parse(id); if (Array.isArray(a)) return a; } catch (_) {}
    return [id];
  }

  async _statusOf(taskId) {
    const { json } = await this._post('/task/openapi/status', { apiKey: this.apiKey, taskId: String(taskId) });
    if (json.code !== 0) throw new Error('RunningHub 状态查询失败: ' + (json.msg || json.message || JSON.stringify(json)));
    return String(json.data);
  }

  async _outputsOf(taskId, saveNodeId) {
    const { json } = await this._post('/task/openapi/outputs', { apiKey: this.apiKey, taskId: String(taskId) });
    if (json.code !== 0) throw new Error('RunningHub 结果查询失败: ' + (json.msg || json.message || JSON.stringify(json)));
    let files = Array.isArray(json.data) ? json.data : [];
    if (saveNodeId) files = files.filter((f) => String(f.nodeId) === String(saveNodeId));
    return files.map((f) => f.fileUrl).filter(Boolean);
  }

  async _download(url, workflowType) {
    const res = await fetch(url, { headers: { 'User-Agent': 'ai-portrait/0.1' } });
    if (!res.ok) throw new Error('下载输出失败: HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = path.join(this.outputDir, workflowType);
    fs.mkdirSync(dir, { recursive: true });
    const extMatch = url.match(/\.(png|jpe?g|webp)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const out = path.join(dir, `${workflowType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    fs.writeFileSync(out, buf);
    return out;
  }

  async getTaskStatus(externalTaskId, ctx = {}) {
    const workflowType = ctx.workflowType || 'wash';
    const saveNodeId = MAPPING[workflowType] ? MAPPING[workflowType].saveNodeId : null;
    const ids = this._parseIds(externalTaskId);

    for (const id of ids) {
      const s = await this._statusOf(id);
      if (s === 'FAILED') return { status: 'failed', error: 'RunningHub 任务失败 (taskId=' + id + ')' };
      if (s === 'CANCEL') return { status: 'failed', error: 'RunningHub 任务已取消 (taskId=' + id + ')' };
      if (s !== 'SUCCESS') return { status: 'running' }; // QUEUED / RUNNING / CREATE
    }

    const images = [];
    for (const id of ids) {
      const urls = await this._outputsOf(id, saveNodeId);
      for (const u of urls) images.push({ path: await this._download(u, workflowType) });
    }
    return { status: 'success', images };
  }
}

module.exports = RunningHubProvider;
