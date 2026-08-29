import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg, downloadImage } from '../api.js';
import { Loading, useToast, Img, Badge, Spinner } from '../components/ui.jsx';
import { TASK_STATUS, fmtTime } from '../labels.js';

const TYPE_LABEL = { wash: '洗图', faceswap: '换脸', enhance: '质感优化' };
const OPTION_LABEL = {
  colorCorrection: { lab: '自动', off: '关闭' },
};

export default function WorkflowDetail() {
  const { type } = useParams();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const res = await api.get(`/api/admin/workflows/${type}`);
    const d = res.data;
    setCfg(d);
    setForm({
      enabled: d.enabled,
      prompt: d.prompt,
      negative_prompt: d.negative_prompt,
      credit_cost: d.credit_cost,
      params: { ...d.effectiveParams },
    });
  }, [type]);

  useEffect(() => { load().catch((e) => toast(errMsg(e), 'error')); }, [load]);

  if (!cfg || !form) return <Loading />;

  const setParam = (key, val) => setForm((f) => ({ ...f, params: { ...f.params, [key]: val } }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/api/admin/workflows/${type}`, form);
      toast('已保存');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('恢复为平台预设默认值？')) return;
    await api.post(`/api/admin/workflows/${type}/reset`).catch((e) => toast(errMsg(e), 'error'));
    toast('已恢复默认值');
    load();
  };

  const basicFields = cfg.schema.filter((f) => !f.advanced);
  const advancedFields = cfg.schema.filter((f) => f.advanced);

  return (
    <div>
      <div className="page-head">
        <h2>{TYPE_LABEL[type] || cfg.name} 工作流</h2>
        <div className="flex gap8 items-center">
          <button className="btn btn-secondary" disabled={busy} onClick={reset}>恢复默认值</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存配置'}</button>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="card card-pad mb16">
            <div className="flex between items-center mb16">
              <div className="card-title" style={{ margin: 0 }}>状态</div>
              <label className="flex items-center gap8" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
                <Badge status={form.enabled ? 'success' : 'gray'} label={form.enabled ? '启用' : '停用'} />
              </label>
            </div>
            <div className="field"><label>消耗额度（每次调用）</label>
              <input className="input" type="number" value={form.credit_cost} onChange={(e) => setForm((f) => ({ ...f, credit_cost: Number(e.target.value) }))} />
            </div>
            <div className="kv"><span className="k">最后更新</span><span className="small">{cfg.updated_by || '-'} · {fmtTime(cfg.updated_at)}</span></div>
          </div>

          <div className="card card-pad mb16">
            <div className="card-title">提示词</div>
            <textarea className="textarea" value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} />
          </div>

          <div className="card card-pad mb16">
            <div className="card-title">负向提示词</div>
            <textarea className="textarea" value={form.negative_prompt} onChange={(e) => setForm((f) => ({ ...f, negative_prompt: e.target.value }))} />
          </div>

          <div className="card card-pad mb16">
            <div className="card-title">参数</div>
            {basicFields.map((f) => <ParamField key={f.key} f={f} value={form.params[f.key]} onChange={(v) => setParam(f.key, v)} />)}
            {basicFields.length === 0 && <div className="small muted">无开放参数</div>}
          </div>

          <div className="card card-pad mb16">
            <div className="card-title" onClick={() => {}}>高级参数</div>
            {advancedFields.map((f) => <ParamField key={f.key} f={f} value={form.params[f.key]} onChange={(v) => setParam(f.key, v)} />)}
          </div>
        </div>

        <div>
          <TestPanel type={type} params={form.params} />
          <div className="card card-pad">
            <div className="card-title">参数修改记录</div>
            {cfg.changelog.length === 0 && <div className="small muted">暂无记录</div>}
            {cfg.changelog.map((c) => (
              <div key={c.id} className="kv">
                <span className="k">{c.field}</span>
                <span className="small muted">{c.old_value ?? '—'} → {c.new_value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamField({ f, value, onChange }) {
  if (f.type === 'textarea') {
    return (
      <div className="field">
        <label>{f.label}</label>
        <textarea className="textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (f.type === 'seed') {
    const fixed = typeof value === 'number';
    return (
      <div className="field">
        <label>{f.label}</label>
        <div className="flex gap8 items-center">
          <select className="select" value={fixed ? 'fixed' : 'random'} onChange={(e) => onChange(e.target.value === 'fixed' ? 0 : null)}>
            <option value="random">随机</option>
            <option value="fixed">固定</option>
          </select>
          {fixed && (
            <input className="input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
          )}
        </div>
      </div>
    );
  }
  if (f.type === 'select') {
    return (
      <div className="field">
        <label>{f.label}</label>
        <select className="select" value={value} onChange={(e) => onChange(cast(e.target.value, f))}>
          {f.options.map((o) => (
            <option key={o} value={o}>{OPTION_LABEL[f.key]?.[o] ?? o}</option>
          ))}
        </select>
      </div>
    );
  }
  if (f.type === 'slider') {
    return (
      <div className="field">
        <label>{f.label}</label>
        <div className="slider-row">
          <input type="range" min={f.min} max={f.max} step={f.step || 0.01} value={value ?? f.min} onChange={(e) => onChange(Number(e.target.value))} />
          <span className="val">{value ?? f.min}</span>
        </div>
      </div>
    );
  }
  // number
  return (
    <div className="field">
      <label>{f.label}</label>
      <input className="input" type="number" min={f.min} max={f.max} step={f.step || 1} value={value ?? ''} onChange={(e) => onChange(cast(e.target.value, f))} />
    </div>
  );
}

function cast(v, f) {
  if (f.type === 'select') return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

function TestPanel({ type, params }) {
  const toast = useToast();
  const [refs, setRefs] = useState([]);
  const [images, setImages] = useState([]);
  const [inputs, setInputs] = useState({});
  const [task, setTask] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/admin/references').then((r) => setRefs(r.data.references.filter((x) => x.status === 'active'))).catch(() => {});
    api.get('/api/admin/images').then((r) => setImages(r.data.images)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!task || (task.status !== 'running' && task.status !== 'waiting')) return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/api/admin/tasks/${task.id}`);
        setTask(r.data.task);
      } catch (_) {}
    }, 2000);
    return () => clearInterval(t);
  }, [task?.status]);

  const run = async () => {
    setBusy(true);
    setTask(null);
    try {
      const res = await api.post(`/api/admin/workflows/${type}/test`, { inputs, parameters: params });
      setTask(res.data.task);
      toast('测试任务已提交');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad mb16">
      <div className="card-title">测试生成（不影响用户）</div>
      {type === 'wash' && (
        <div className="field">
          <label>测试参考照片</label>
          <select className="select" value={inputs.referenceImageId || ''} onChange={(e) => setInputs((x) => ({ ...x, referenceImageId: Number(e.target.value) }))}>
            <option value="">选择参考照片…</option>
            {refs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}
      {type === 'faceswap' && (
        <>
          <div className="field"><label>人脸图</label>
            <select className="select" value={inputs.faceImageId || ''} onChange={(e) => setInputs((x) => ({ ...x, faceImageId: Number(e.target.value) }))}>
              <option value="">选择图片…</option>
              {images.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.kind} {i.user || ''}</option>)}
            </select>
          </div>
          <div className="field"><label>目标图</label>
            <select className="select" value={inputs.targetImageId || ''} onChange={(e) => setInputs((x) => ({ ...x, targetImageId: Number(e.target.value) }))}>
              <option value="">选择图片…</option>
              {images.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.kind} {i.user || ''}</option>)}
            </select>
          </div>
        </>
      )}
      {type === 'enhance' && (
        <div className="field"><label>测试图片</label>
          <select className="select" value={inputs.imageId || ''} onChange={(e) => setInputs((x) => ({ ...x, imageId: Number(e.target.value) }))}>
            <option value="">选择图片…</option>
            {images.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.kind} {i.user || ''}</option>)}
          </select>
        </div>
      )}
      <button className="btn btn-secondary btn-block" disabled={busy} onClick={run}>{busy ? '提交中…' : '测试当前参数'}</button>

      {task && (
        <div className="mt16">
          <div className="flex items-center gap8 mb8">
            <Badge status={task.status} label={TASK_STATUS[task.status] || task.status} />
            {task.error && <span className="small" style={{ color: 'var(--danger)' }}>{task.error}</span>}
            {(task.status === 'running' || task.status === 'waiting') && <Spinner size={16} />}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(task.result?.images || []).map((i, idx) => (
              <div key={idx}>
                <Img src={i.url} style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 8 }} />
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => downloadImage(i.url)}>下载</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
