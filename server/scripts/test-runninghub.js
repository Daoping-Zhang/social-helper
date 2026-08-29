#!/usr/bin/env node
// RunningHub 连通性测试脚本
// 用法：
//   node server/scripts/test-runninghub.js <本地图片路径> [workflowType] [candidateCount]
// 环境变量：
//   RH_API_KEY                必填
//   RH_WORKFLOW_ID_WASH       可选（测试洗图）
//   RH_WORKFLOW_ID_FACESWAP   可选
//   RH_WORKFLOW_ID_ENHANCE    可选
//   RH_BASE_URL               可选，默认 https://www.runninghub.cn
//
// 示例：
//   RH_API_KEY=xxx RH_WORKFLOW_ID_WASH=123 node server/scripts/test-runninghub.js ./test.png wash 2

const fs = require('fs');
const path = require('path');

const RunningHubProvider = require('../src/ai/runningHubProvider');

const imagePath = process.argv[2];
const workflowType = process.argv[3] || 'wash';
const candidateCount = parseInt(process.argv[4], 10) || 2;

if (!process.env.RH_API_KEY) {
  console.error('缺少 RH_API_KEY 环境变量');
  process.exit(1);
}
if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('请提供本地图片路径，例如：node server/scripts/test-runninghub.js ./test.png wash 2');
  process.exit(1);
}

const provider = new RunningHubProvider();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1) 上传连通性测试
  console.log('== 1. 上传图片（验证 API Key）==');
  const fileName = await provider.uploadImage(path.resolve(imagePath));
  console.log('   上传成功，fileName =', fileName);

  const workflowId = provider.workflowIds[workflowType];
  if (!workflowId) {
    console.log(`   未配置 RH_WORKFLOW_ID_${workflowType.toUpperCase()}，跳过任务提交。`);
    console.log('   结论：API Key 有效，上传接口可通。');
    return;
  }

  // 2) 提交任务
  console.log(`== 2. 提交 ${workflowType} 任务（workflowId=${workflowId}）==`);
  const parameters =
    workflowType === 'wash'
      ? { candidateCount, denoise: 0.5, steps: 10, cfg: 1, outputResolution: 1480 }
      : workflowType === 'faceswap'
        ? { denoise: 0.5, steps: 26, cfg: 1.8, faceStrength: 1, outputResolution: 2048 }
        : { outputResolution: 4096, batchSize: 5, colorCorrection: 'lab', overlapRate: 0.15 };
  const inputs =
    workflowType === 'wash'
      ? { referenceImage: path.resolve(imagePath) }
      : workflowType === 'faceswap'
        ? { faceImage: path.resolve(imagePath), targetImage: path.resolve(imagePath) }
        : { image: path.resolve(imagePath) };

  const { externalTaskId } = await provider.submitWorkflow({ workflowType, inputs, parameters });
  console.log('   externalTaskId =', externalTaskId);

  // 3) 轮询
  console.log('== 3. 轮询任务状态 ==');
  const deadline = Date.now() + 30 * 60 * 1000; // 最多 30 分钟
  let last;
  while (Date.now() < deadline) {
    last = await provider.getTaskStatus(externalTaskId, { workflowType });
    console.log(`   [${new Date().toISOString()}] status=${last.status}${last.error ? ' error=' + last.error : ''}`);
    if (last.status === 'success') break;
    if (last.status === 'failed') break;
    await sleep(5000);
  }

  if (last && last.status === 'success') {
    console.log('== 4. 结果 ==');
    last.images.forEach((img, i) => console.log(`   输出 ${i + 1}: ${img.path}`));
    console.log('结论：RunningHub API 全链路可通（上传 → 提交 → 轮询 → 下载）。');
  } else {
    console.log('结论：任务未成功，请检查 workflowId / 工作流配置 / 余额。');
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error('测试失败:', err.message);
  process.exitCode = 1;
});
