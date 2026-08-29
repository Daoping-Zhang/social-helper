import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Modal, Img, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, fmtTime } from '../labels.js';

export default function UserDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const toast = useToast();

  const load = () => api.get(`/api/admin/users/${id}`).then((r) => setData(r.data));

  useEffect(() => {
    load().catch((e) => toast(errMsg(e), 'error'));
  }, [id]);

  if (!data) return <Loading />;
  const { user, stats } = data;

  const toggleStatus = async () => {
    const next = user.status === 'active' ? 'disabled' : 'active';
    await api.patch(`/api/admin/users/${id}`, { status: next }).catch((e) => toast(errMsg(e), 'error'));
    load();
  };

  return (
    <div>
      <div className="page-head">
        <h2>用户详情</h2>
        <div className="flex gap8">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>编辑用户</button>
          <button className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-primary'}`} onClick={toggleStatus}>
            {user.status === 'active' ? '停用' : '启用'}
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <div className="card-title">用户信息</div>
          <div className="kv"><span className="k">用户名</span><span>{user.display_name}</span></div>
          <div className="kv"><span className="k">登录账号</span><span>{user.username}</span></div>
          <div className="kv"><span className="k">创建时间</span><span>{fmtTime(user.created_at)}</span></div>
          <div className="kv"><span className="k">状态</span><Badge status={user.status === 'active' ? 'success' : 'gray'} label={user.status === 'active' ? '启用' : '停用'} /></div>
          <div className="kv"><span className="k">备注</span><span>{user.note || '-'}</span></div>
        </div>
        <div className="card card-pad">
          <div className="card-title">额度</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{user.credits}</div>
          <div className="flex gap8 mt16">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowCredit(true)}>充值 / 扣减额度</button>
          </div>
          <div className="card-title mt16">使用统计</div>
          <div className="kv"><span className="k">项目总数</span><span>{stats.projects}</span></div>
          <div className="kv"><span className="k">洗图 / 换脸 / 优化</span><span>{stats.wash} / {stats.faceswap} / {stats.enhance}</span></div>
          <div className="kv"><span className="k">总消耗额度</span><span>{stats.spent}</span></div>
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">最近作品</div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
          {data.projects.slice(0, 12).map((p) => (
            <Link key={p.id} to={`/admin/projects/${p.id}`} style={{ flex: '0 0 auto' }}>
              <Img src={p.cover} style={{ width: 80, height: 100, borderRadius: 8, objectFit: 'cover' }} />
            </Link>
          ))}
          {data.projects.length === 0 && <div className="small muted">暂无作品</div>}
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">项目历史</div>
        {data.projects.length === 0 ? (
          <div className="small muted">暂无项目</div>
        ) : (
          data.projects.map((p) => (
            <Link key={p.id} to={`/admin/projects/${p.id}`} className="kv" style={{ color: 'inherit' }}>
              <span className="k">项目 #{p.id} · {fmtTime(p.created_at)}</span>
              <Badge status={p.status} label={PROJECT_STATUS[p.status] || p.status} />
            </Link>
          ))
        )}
      </div>

      {showEdit && (
        <EditModal user={user} onClose={() => setShowEdit(false)} onDone={() => { setShowEdit(false); load(); }} />
      )}
      {showCredit && (
        <CreditModal user={user} onClose={() => setShowCredit(false)} onDone={() => { setShowCredit(false); load(); }} />
      )}
    </div>
  );
}

function EditModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ display_name: user.display_name, note: user.note || '', status: user.status, password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/users/${user.id}`, form);
      toast('已保存');
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="编辑用户" onClose={onClose}>
      <div className="field"><label>用户名称</label><input className="input" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} /></div>
      <div className="field"><label>备注</label><textarea className="textarea" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
      <div className="field"><label>重置密码（留空则不修改）</label><input className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
      <div className="field"><label>状态</label>
        <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          <option value="active">启用</option><option value="disabled">停用</option>
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '保存中…' : '保存'}</button>
    </Modal>
  );
}

function CreditModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/users/${user.id}/credits`, { delta: Number(delta), reason });
      toast('额度已调整');
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`调整额度 · ${user.display_name}`} onClose={onClose}>
      <div className="field"><label>当前额度</label><div style={{ fontSize: 22, fontWeight: 800 }}>{user.credits}</div></div>
      <div className="field"><label>变动（+增加 / -扣减）</label><input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} /></div>
      <div className="field"><label>原因</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '处理中…' : '确认'}</button>
    </Modal>
  );
}
