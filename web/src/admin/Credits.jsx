import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Modal } from '../components/ui.jsx';
import { fmtTime } from '../labels.js';

export default function Credits() {
  const [data, setData] = useState(null);
  const [target, setTarget] = useState(null);
  const toast = useToast();

  const load = () => api.get('/api/admin/credits').then((r) => setData(r.data));

  useEffect(() => {
    load().catch((e) => toast(errMsg(e), 'error'));
  }, []);

  if (!data) return <Loading />;

  return (
    <div>
      <div className="page-head">
        <h2>额度管理</h2>
        <span className="small muted">点击「充值/扣减」为用户调整额度</span>
      </div>

      <div className="card mb16">
        <table className="table">
          <thead><tr><th>用户</th><th>账号</th><th>额度</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td>{u.username}</td>
                <td style={{ fontWeight: 700 }}>{u.credits}</td>
                <td>{u.status === 'active' ? '启用' : '停用'}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setTarget(u)}>充值 / 扣减</button>
                </td>
              </tr>
            ))}
            {data.users.length === 0 && <tr><td colSpan={5} className="empty">暂无用户</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}><div className="card-title">调整记录</div></div>
        <table className="table">
          <thead><tr><th>用户</th><th>变动</th><th>原因</th><th>时间</th></tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id}>
                <td>{(data.users.find((u) => u.id === t.user_id) || {}).display_name || t.user_id}</td>
                <td style={{ color: t.delta > 0 ? '#16a34a' : '#6b7280', fontWeight: 600 }}>{t.delta > 0 ? `+${t.delta}` : t.delta}</td>
                <td className="small">{t.reason || '-'}</td>
                <td className="small muted">{fmtTime(t.created_at)}</td>
              </tr>
            ))}
            {data.transactions.length === 0 && <tr><td colSpan={4} className="empty">暂无记录</td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <CreditModal
          user={target}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function CreditModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (delta === '' || Number(delta) === 0) return toast('请输入非 0 的额度变动', 'error');
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
      <div className="field">
        <label>当前额度</label>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{user.credits}</div>
      </div>
      <div className="field">
        <label>变动（正数充值 / 负数扣减）</label>
        <input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="例如 +50 或 -10" />
      </div>
      <div className="field">
        <label>原因</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="管理员充值 / 补偿 / 扣减等" />
      </div>
      <div className="flex gap8">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>取消</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={submit}>{busy ? '处理中…' : '确认调整'}</button>
      </div>
    </Modal>
  );
}
