export const PROJECT_STATUS = {
  ready: '等待上传',
  washing: '洗图中',
  awaiting_selection: '等待选择',
  ready_for_faceswap: '待换脸',
  faceswapping: '换脸中',
  awaiting_enhance: '待优化',
  enhancing: '优化中',
  completed: '已完成',
  failed: '失败',
};

export const TASK_STATUS = {
  waiting: '等待中',
  running: '运行中',
  success: '成功',
  failed: '失败',
};

export const WORKFLOW_TYPE = {
  wash: '洗图',
  faceswap: '换脸',
  enhance: '质感优化',
};

export const STATUS_COLOR = {
  completed: 'green',
  success: 'green',
  ready: 'blue',
  washing: 'orange',
  faceswapping: 'orange',
  enhancing: 'orange',
  awaiting_selection: 'purple',
  ready_for_faceswap: 'purple',
  awaiting_enhance: 'purple',
  running: 'orange',
  waiting: 'gray',
  failed: 'red',
};

export function fmtTime(s) {
  if (!s) return '-';
  return String(s).replace('T', ' ').replace('Z', '').slice(0, 19);
}
