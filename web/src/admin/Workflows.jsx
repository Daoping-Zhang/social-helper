import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Badge } from '../components/ui.jsx';
import { fmtTime } from '../labels.js';

const TYPE_LABEL = { wash: '洗图', faceswap: '换脸', enhance: '质感优化' };

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/api/admin/workflows').then((r) => setWorkflows(r.data.workflows)).catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-head"><h2>工作流</h2></div>
      <div className="three-col">
        {workflows.map((w) => (
          <Link key={w.type} to={`/admin/workflows/${w.type}`} className="card card-pad" style={{ color: 'inherit', display: 'block' }}>
            <div className="flex between items-center mb16">
              <h3 style={{ margin: 0 }}>{TYPE_LABEL[w.type] || w.name}</h3>
              <Badge status={w.enabled ? 'success' : 'gray'} label={w.enabled ? '启用' : '停用'} />
            </div>
            <div className="kv"><span className="k">消耗额度</span><span>{w.credit_cost}</span></div>
            <div className="kv"><span className="k">候选数量</span><span>{w.effectiveParams?.candidateCount ?? '-'}</span></div>
            <div className="small muted mt8" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {w.prompt || '（无提示词）'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
