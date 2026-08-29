import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg, downloadImage } from '../api.js';
import { Loading, useToast, Img, Modal, Badge } from '../components/ui.jsx';
import { TASK_STATUS, WORKFLOW_TYPE, fmtTime } from '../labels.js';

const inputUrl = (rel) => (rel ? '/files/' + String(rel).split('\\').join('/') : null);

const INPUT_LABEL = { referenceImage: '参考照片', faceImage: '人脸照片', targetImage: '目标照片', image: '输入图片' };
const PARAM_LABEL = {
  seed: '随机种子', steps: '生成步数', cfg: '提示词强度', denoise: '重绘强度',
  candidateCount: '候选数量', outputResolution: '输出分辨率', faceStrength: '人脸相似度',
  batchSize: '批处理大小', colorCorrection: '色彩校正', overlapRate: '分块重叠率',
  prompt: '提示词', negative_prompt: '负向提示词', instantIdWeight: '人脸权重',
  loraStrengthModel: 'LoRA 模型强度', loraStrengthClip: 'LoRA Clip 强度',
};
const fmtParam = (k, v) => {
  if (k === 'colorCorrection') return v === 'lab' ? '自动' : v === 'off' ? '关闭' : String(v);
  if (v === null || v === undefined) return '随机';
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
};

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [showRerun, setShowRerun] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get(`/api/admin/tasks/${id}`).then((r) => setTask(r.data.task));

  useEffect(() => {
    load().catch((e) => toast(errMsg(e), 'error'));
  }, [id]);

  const rerun = async (parameters) => {
    setBusy(true);
    try {
      const res = await api.post(`/api/admin/tasks/${id}/rerun`, { parameters });
      toast(`已重新执行，新任务 #${res.data.task.id}`);
      setShowRerun(false);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!task) return <Loading />;

  const inputs = task.inputs || {};
  const inputEntries = Object.entries(inputs).filter(([, v]) => v);
  const outputs = (task.result?.images || []).map((i) => i.url);

  return (
    <div>
      <div className="page-head">
        <h2>任务 #{task.id} · {WORKFLOW_TYPE[task.workflow_type] || task.workflow_type}</h2>
        <div className="flex gap8">
          <button className="btn btn-secondary" disabled={busy} onClick={() => rerun(null)}>重新运行（原参数）</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => setShowRerun(true)}>调整参数重新运行</button>
        </div>
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <div className="card-title">基本信息</div>
          <div className="kv"><span className="k">任务 ID</span><span>#{task.id}</span></div>
          <div className="kv"><span className="k">所属项目</span><span>{task.is_test ? '测试任务' : task.project_id ? <Link to={`/admin/projects/${task.project_id}`}>#{task.project_id}</Link> : '-'}</span></div>
          <div className="kv"><span className="k">类型</span><span>{WORKFLOW_TYPE[task.workflow_type] || task.workflow_type}</span></div>
          <div className="kv"><span className="k">创建时间</span><span>{fmtTime(task.created_at)}</span></div>
          <div className="kv"><span className="k">完成时间</span><span>{fmtTime(task.completed_at)}</span></div>
        </div>
        <div className="card card-pad">
          <div className="card-title">接口状态</div>
          <div className="kv"><span className="k">状态</span><Badge status={task.status} label={TASK_STATUS[task.status] || task.status} /></div>
          <div className="kv"><span className="k">RunningHub 任务 ID</span><span className="small" style={{ wordBreak: 'break-all' }}>{task.external_task_id || '-'}</span></div>
          <div className="kv"><span className="k">失败原因</span><span style={{ color: 'var(--danger)' }}>{task.error || '-'}</span></div>
          <div className="kv"><span className="k">消耗额度</span><span>{task.credit_cost}</span></div>
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">输入图片</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {inputEntries.map(([k, v]) => (
            <div key={k}>
              <Img src={inputUrl(v)} style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 8 }} />
              <div className="small muted" style={{ marginTop: 4 }}>{INPUT_LABEL[k] || k}</div>
            </div>
          ))}
          {inputEntries.length === 0 && <div className="small muted">无</div>}
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">本次实际参数</div>
        <div className="card card-pad" style={{ background: '#f8fafc' }}>
          {Object.entries(task.params || {}).map(([k, v]) => (
            <div className="kv" key={k}>
              <span className="k">{PARAM_LABEL[k] || k}</span>
              <span>{fmtParam(k, v)}</span>
            </div>
          ))}
          {Object.keys(task.params || {}).length === 0 && <div className="small muted">无参数</div>}
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">输出图片</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {outputs.map((u, i) => (
            <div key={i}>
              <Img src={u} style={{ width: 140, height: 175, objectFit: 'cover', borderRadius: 8 }} />
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => downloadImage(u)}>下载</button>
            </div>
          ))}
          {outputs.length === 0 && <div className="small muted">无输出</div>}
        </div>
      </div>

      {showRerun && (
        <RerunModal
          task={task}
          onClose={() => setShowRerun(false)}
          onRun={(params) => rerun(params)}
        />
      )}
    </div>
  );
}

function RerunModal({ task, onClose, onRun }) {
  const [text, setText] = useState(JSON.stringify(task.params || {}, null, 2));
  const [error, setError] = useState('');
  const submit = () => {
    try {
      const params = JSON.parse(text || '{}');
      onRun(params);
    } catch (e) {
      setError('JSON 格式错误：' + e.message);
    }
  };
  return (
    <Modal title="调整参数并重新运行" onClose={onClose} maxWidth={640}>
      <div className="small muted mb16">高级：直接编辑参数 JSON（键名与工作流参数一致），仅影响本次任务，不修改全局默认参数。</div>
      <textarea className="textarea" style={{ minHeight: 260, fontFamily: 'monospace', fontSize: 12 }} value={text} onChange={(e) => { setText(e.target.value); setError(''); }} />
      {error && <div className="small" style={{ color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
      <button className="btn btn-primary btn-block mt16" onClick={submit}>重新执行</button>
    </Modal>
  );
}
