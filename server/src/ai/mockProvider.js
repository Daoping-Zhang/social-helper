const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const DEFAULT_DURATION = parseInt(process.env.MOCK_DURATION_MS || '3500', 10);

// Mock AI Provider：不依赖真实 RunningHub / ComfyUI。
// 它把任务状态持久化到磁盘，延迟“完成”，并将输入图片复制为输出，
// 用于在真实 RunningHub 接口接入前跑通整条产品流程。
// 真实接入时，按产品文档抽象成同一接口：
//   submitWorkflow() / getTaskStatus()
// 并替换为 RunningHubProvider。
class MockProvider {
  constructor() {
    this.jobsDir = config.MOCK_JOBS_DIR;
  }

  _jobPath(id) {
    return path.join(this.jobsDir, `${id}.json`);
  }

  submitWorkflow({ workflowType, inputs, parameters }) {
    const externalTaskId = crypto.randomUUID();
    const job = {
      externalTaskId,
      workflowType,
      inputs, // 绝对路径
      parameters,
      startedAt: Date.now(),
      durationMs: DEFAULT_DURATION,
      outputDir: path.join(config.GENERATED_DIR, workflowType),
      done: false,
    };
    fs.mkdirSync(job.outputDir, { recursive: true });
    fs.writeFileSync(this._jobPath(externalTaskId), JSON.stringify(job));
    return { externalTaskId };
  }

  _generateOutputs(job) {
    fs.mkdirSync(job.outputDir, { recursive: true });
    const images = [];
    const ext = this._ext(job.inputs);

    if (job.workflowType === 'wash') {
      let n = parseInt(job.parameters.candidateCount, 10);
      if (!Number.isFinite(n) || n < 2) n = 4;
      if (n > 8) n = 8;
      for (let i = 1; i <= n; i++) {
        const out = path.join(job.outputDir, `wash-${job.externalTaskId.slice(0, 8)}-${i}${ext}`);
        fs.copyFileSync(job.inputs.referenceImage, out);
        images.push(out);
      }
    } else if (job.workflowType === 'faceswap') {
      const out = path.join(job.outputDir, `faceswap-${job.externalTaskId.slice(0, 8)}${ext}`);
      fs.copyFileSync(job.inputs.targetImage, out);
      images.push(out);
    } else if (job.workflowType === 'enhance') {
      const out = path.join(job.outputDir, `enhance-${job.externalTaskId.slice(0, 8)}${ext}`);
      fs.copyFileSync(job.inputs.image, out);
      images.push(out);
    }
    return images;
  }

  _ext(inputs) {
    const src = inputs.referenceImage || inputs.targetImage || inputs.image || '';
    const e = path.extname(src).toLowerCase();
    return e || '.jpg';
  }

  getTaskStatus(externalTaskId) {
    const p = this._jobPath(externalTaskId);
    if (!fs.existsSync(p)) {
      return { status: 'failed', error: 'mock job not found' };
    }
    const job = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Date.now() - job.startedAt < job.durationMs) {
      return { status: 'running' };
    }
    if (!job.done) {
      job.outputs = this._generateOutputs(job);
      job.done = true;
      fs.writeFileSync(p, JSON.stringify(job));
    }
    return {
      status: 'success',
      images: job.outputs.map((abs) => ({ path: abs })),
    };
  }
}

module.exports = MockProvider;
