import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Modal, Badge } from '../components/ui.jsx';
import { fmtTime } from '../labels.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creditTarget, setCreditTarget] = useState(null);
  const toast = useToast();

  const load = () => api.get('/api/admin/users').then((r) => setUsers(r.data.users));

  useEffect(() => {
    load().catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-head">
        <h2>用户管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>创建用户</button>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>用户</th><th>账号</th><th>额度</th><th>项目数</th><th>最近使用</th><th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.filter((u) => u.role === 'user').map((u) => (
              <tr key={u.id}>
                <td><Link to={`/admin/users/${u.id}`}>{u.display_name}</Link></td>
                <td>{u.username}</td>
                <td style={{ fontWeight: 700 }}>{u.credits}</td>
                <td>{u.project_count}</td>
                <td className="small muted">{u.last_used ? fmtTime(u.last_used) : '-'}</td>
                <td><Badge status={u.status === 'active' ? 'success' : 'gray'} label={u.status === 'active' ? '启用' : '停用'} /></td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setCreditTarget(u)}>充值 / 扣减</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {creditTarget && (
        <CreditModal
          user={creditTarget}
          onClose={() => setCreditTarget(null)}
          onDone={() => { setCreditTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: '', password: '', display_name: '', credits: 50, note: '', status: 'active' });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/api/admin/users', form);
      setCreated(res.data.user);
      toast('用户创建成功');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const info = `账号：${created.username}\n初始密码：${form.password}\n额度：${created.credits}`;
    return (
      <Modal title="用户创建成功" onClose={onCreated}>
        <pre className="card card-pad" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14 }}>{info}</pre>
        <button
          className="btn btn-secondary btn-block"
          onClick={() => { navigator.clipboard?.writeText(info); toast('已复制'); }}
        >
          复制账号信息
        </button>
        <button className="btn btn-primary btn-block mt8" onClick={onCreated}>完成</button>
      </Modal>
    );
  }

  return (
    <Modal title="创建用户" onClose={onClose}>
      <div className="field"><label>用户名称</label><input className="input" value={form.display_name} onChange={set('display_name')} /></div>
      <div className="field"><label>登录账号</label><input className="input" value={form.username} onChange={set('username')} /></div>
      <div className="field"><label>初始密码</label><input className="input" value={form.password} onChange={set('password')} /></div>
      <div className="field"><label>初始额度</label><input className="input" type="number" value={form.credits} onChange={set('credits')} /></div>
      <div className="field"><label>用户备注</label><textarea className="textarea" value={form.note} onChange={set('note')} placeholder="客户来源 / 内部编号等" /></div>
      <div className="field"><label>状态</label>
        <select className="select" value={form.status} onChange={set('status')}>
          <option value="active">启用</option>
          <option value="disabled">停用</option>
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '创建中…' : '创建'}</button>
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
    <Modal title={`充值 / 扣减额度 · ${user.display_name}`} onClose={onClose}>
      <div className="field"><label>当前额度</label><div style={{ fontSize: 22, fontWeight: 800 }}>{user.credits}</div></div>
      <div className="field"><label>变动（正数充值 / 负数扣减）</label><input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="例如 +50 或 -10" /></div>
      <div className="field"><label>原因</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="管理员充值 / 补偿等" /></div>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '处理中…' : '确认'}</button>
    </Modal>
  );
}
