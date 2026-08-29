import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Loading, useToast } from '../components/ui.jsx';
import { fmtTime } from '../labels.js';

export default function Account() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [txs, setTxs] = useState([]);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/account/me').then((r) => setData(r.data)).catch((e) => toast(errMsg(e), 'error'));
    api.get('/api/account/transactions').then((r) => setTxs(r.data.transactions)).catch(() => {});
  }, []);

  if (!data) return <Loading text="加载中…" />;

  return (
    <div className="user-content">
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
            {data.display_name?.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{data.display_name}</div>
            <div className="small muted">账号：{data.username}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{data.credits}</div>
            <div className="small muted">剩余额度</div>
          </div>
        </div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">使用统计</div>
        <div className="kv"><span className="k">项目总数</span><span>{data.stats.projects}</span></div>
        <div className="kv"><span className="k">洗图次数</span><span>{data.stats.wash}</span></div>
        <div className="kv"><span className="k">换脸次数</span><span>{data.stats.faceswap}</span></div>
        <div className="kv"><span className="k">最终优化次数</span><span>{data.stats.enhance}</span></div>
        <div className="kv"><span className="k">总消耗额度</span><span>{data.total_spent}</span></div>
      </div>

      <div className="card card-pad mt16">
        <div className="card-title">额度记录</div>
        {txs.length === 0 ? (
          <div className="small muted">暂无记录</div>
        ) : (
          txs.slice(0, 20).map((t) => (
            <div key={t.id} className="kv">
              <span className="k">{t.reason || '额度变动'} · {fmtTime(t.created_at)}</span>
              <span style={{ color: t.delta > 0 ? '#16a34a' : '#9aa3b2', fontWeight: 600 }}>
                {t.delta > 0 ? `+${t.delta}` : t.delta}
              </span>
            </div>
          ))
        )}
      </div>

      {user?.role === 'admin' && (
        <button className="btn btn-secondary btn-block mt16" onClick={() => navigate('/admin')}>进入管理后台</button>
      )}
      <button className="btn btn-ghost btn-block mt8" onClick={() => { logout(); navigate('/login'); }}>退出登录</button>
    </div>
  );
}
