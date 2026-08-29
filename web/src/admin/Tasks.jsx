import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Badge } from '../components/ui.jsx';
import { TASK_STATUS, WORKFLOW_TYPE, fmtTime } from '../labels.js';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (type) params.workflow_type = type;
    api.get('/api/admin/tasks', { params }).then((r) => setTasks(r.data.tasks)).catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, type]);

  return (
    <div>
      <div className="page-head">
        <h2>AI 任务</h2>
        <div className="flex gap8">
          <select className="select" style={{ width: 140 }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">全部类型</option>
            <option value="wash">洗图</option>
            <option value="faceswap">换脸</option>
            <option value="enhance">质感优化</option>
          </select>
          <select className="select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="waiting">等待中</option>
            <option value="running">运行中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>任务</th><th>用户</th><th>项目</th><th>类型</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/admin/tasks/${t.id}`}>#{t.id}{t.is_test ? '（测试）' : ''}</Link></td>
                <td>{t.user || '-'}</td>
                <td>{t.project_id ? <Link to={`/admin/projects/${t.project_id}`}>#{t.project_id}</Link> : '-'}</td>
                <td>{WORKFLOW_TYPE[t.workflow_type] || t.workflow_type}</td>
                <td><Badge status={t.status} label={TASK_STATUS[t.status] || t.status} /></td>
                <td className="small muted">{fmtTime(t.created_at)}</td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={6} className="empty">暂无任务</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
