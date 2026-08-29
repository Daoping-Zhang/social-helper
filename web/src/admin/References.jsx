import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Modal, Img, Badge } from '../components/ui.jsx';

const CATEGORIES = ['商务', '西装', '高级感', '休闲', '户外', '社交头像', '黑白', '时尚', '其他'];

export default function References() {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = () => api.get('/api/admin/references').then((r) => setRefs(r.data.references));

  useEffect(() => { load().catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false)); }, []);

  const hide = async (r) => {
    if (!window.confirm(`隐藏「${r.name}」？隐藏后不影响已生成的历史项目。`)) return;
    await api.delete(`/api/admin/references/${r.id}`).catch((e) => toast(errMsg(e), 'error'));
    load();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-head">
        <h2>参考照片</h2>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>上传参考照片</button>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>图片</th><th>名称</th><th>分类</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {refs.map((r) => (
              <tr key={r.id}>
                <td><Img src={r.url} className="thumb" /></td>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td>{r.sort_order}</td>
                <td><Badge status={r.status === 'active' ? 'success' : 'gray'} label={r.status === 'active' ? '展示' : '隐藏'} /></td>
                <td>
                  <div className="flex gap8">
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditing(r)}>编辑</button>
                    {r.status === 'active' && <button className="btn btn-sm btn-ghost" onClick={() => hide(r)}>隐藏</button>}
                  </div>
                </td>
              </tr>
            ))}
            {refs.length === 0 && <tr><td colSpan={6} className="empty">暂无参考照片</td></tr>}
          </tbody>
        </table>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
      {editing && <EditModal r={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ name: '', category: '商务', sort_order: 0, status: 'active' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return toast('请选择图片', 'error');
    if (!form.name) return toast('请填写名称', 'error');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', form.name);
    fd.append('category', form.category);
    fd.append('sort_order', String(form.sort_order));
    fd.append('status', form.status);
    setBusy(true);
    try {
      await api.post('/api/admin/references', fd);
      toast('上传成功');
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="上传参考照片" onClose={onClose}>
      <div className="field"><label>图片</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="input" />
      </div>
      <div className="field"><label>名称</label><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="黑西装高级商务" /></div>
      <div className="row">
        <div className="field"><label>分类</label>
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>排序</label><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
      </div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '上传中…' : '上传'}</button>
    </Modal>
  );
}

function EditModal({ r, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: r.name, category: r.category, sort_order: r.sort_order, status: r.status });
  const submit = async () => {
    await api.patch(`/api/admin/references/${r.id}`, form).catch((e) => toast(errMsg(e), 'error'));
    toast('已保存');
    onDone();
  };
  return (
    <Modal title="编辑参考照片" onClose={onClose}>
      <Img src={r.url} style={{ width: 100, height: 125, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
      <div className="field"><label>名称</label><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
      <div className="row">
        <div className="field"><label>分类</label>
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>排序</label><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
      </div>
      <div className="field"><label>状态</label>
        <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          <option value="active">展示</option><option value="hidden">隐藏</option>
        </select>
      </div>
      <button className="btn btn-primary btn-block" onClick={submit}>保存</button>
    </Modal>
  );
}
