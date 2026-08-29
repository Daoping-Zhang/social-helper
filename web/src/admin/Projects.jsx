import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Img, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, fmtTime } from '../labels.js';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/api/admin/projects').then((r) => setProjects(r.data.projects)).catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-head"><h2>生成项目</h2></div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>项目</th><th>用户</th><th>参考图</th><th>当前阶段</th><th>创建时间</th></tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/admin/projects/${p.id}`} className="flex items-center gap8">
                    <Img src={p.cover} className="thumb" />
                    <span>#{p.id}</span>
                  </Link>
                </td>
                <td>{p.user}</td>
                <td className="small muted">{p.reference_name || '-'}</td>
                <td><Badge status={p.status} label={PROJECT_STATUS[p.status] || p.status} /></td>
                <td className="small muted">{fmtTime(p.created_at)}</td>
              </tr>
            ))}
            {projects.length === 0 && <tr><td colSpan={5} className="empty">暂无项目</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
