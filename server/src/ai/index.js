const MockProvider = require('./mockProvider');
const RunningHubProvider = require('./runningHubProvider');
const config = require('../config');

// AI Provider 统一接口：
//   submitWorkflow({ workflowType, inputs(abs paths), parameters }) -> { externalTaskId }
//   getTaskStatus(externalTaskId, { workflowType }) -> { status: 'running'|'success'|'failed', images?, error? }
// 产品层只依赖该接口；切换 provider 不影响业务逻辑。

const providers = {
  mock: () => new MockProvider(),
  runninghub: () => new RunningHubProvider(),
};

function getProvider() {
  const name = config.AI_PROVIDER || 'mock';
  const factory = providers[name];
  if (!factory) throw new Error(`未知 AI_PROVIDER: ${name}`);
  return factory();
}

module.exports = { getProvider, MockProvider, RunningHubProvider };
