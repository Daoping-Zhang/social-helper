import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Img, Loading, useToast, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, fmtTime } from '../labels.js';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.get('/api/projects')
      .then((res) => setProjects(res.data.projects))
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="加载作品…" />;

  return (
    <div className="user-content">
      <h2>我的作品</h2>
      {projects.length === 0 ? (
        <div className="empty">还没有生成记录，去首页选择一张参考照片开始吧</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map((p) => (
            <div key={p.id} className="card work-card" onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
              <Img src={p.cover} alt="" style={{ width: 68, height: 86, borderRadius: 8, objectFit: 'cover' }} />
              <div className="info">
                <div className="t">项目 #{p.id}</div>
                <div className="s">{fmtTime(p.created_at)}</div>
                <div className="s" style={{ marginTop: 6 }}>
                  <Badge status={p.status} label={PROJECT_STATUS[p.status] || p.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
