import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Badge } from '../components/ui.jsx';

const TYPE_LABEL = { wash: '洗图', faceswap: '换脸', enhance: '质感优化' };

export default function Settings() {
  const [data, setData] = useState(null);
  const [defaultCredits, setDefaultCredits] = useState(50);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/api/admin/settings').then((r) => {
      setData(r.data);
      setDefaultCredits(Number(r.data.settings.defaultCredits) || 50);
    }).catch((e) => toast(errMsg(e), 'error'));
  }, []);

  if (!data) return <Loading />;

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/api/admin/settings', { settings: { defaultCredits: String(defaultCredits) } });
      toast('已保存');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head"><h2>系统设置</h2></div>

      <div className="card card-pad mb16">
        <div className="card-title">用户</div>
        <div className="field"><label>新建用户默认额度</label>
          <div className="flex gap8 items-center">
            <input className="input" type="number" style={{ maxWidth: 160 }} value={defaultCredits} onChange={(e) => setDefaultCredits(Number(e.target.value))} />
            <button className="btn btn-primary" disabled={busy} onClick={save}>保存</button>
          </div>
        </div>
      </div>

      <div className="card card-pad mb16">
        <div className="card-title">各环节消耗额度</div>
        <table className="table">
          <thead><tr><th>工作流</th><th>消耗额度</th><th>操作</th></tr></thead>
          <tbody>
            {data.workflows.map((w) => (
              <tr key={w.workflow_type}>
                <td>{TYPE_LABEL[w.workflow_type] || w.name}</td>
                <td style={{ fontWeight: 700 }}>{w.credit_cost}</td>
                <td><Link to={`/admin/workflows/${w.workflow_type}`}>配置</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <div className="card-title">AI 工作流状态</div>
        {data.workflows.map((w) => (
          <div key={w.workflow_type} className="kv">
            <span className="k">{TYPE_LABEL[w.workflow_type] || w.name}</span>
            <Badge status={w.enabled ? 'success' : 'gray'} label={w.enabled ? '开' : '关'} />
          </div>
        ))}
        <div className="small muted mt8">某个工作流出现问题时，可前往对应工作流页面暂时关闭。</div>
      </div>
    </div>
  );
}
