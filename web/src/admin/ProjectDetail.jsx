import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg, downloadImage } from '../api.js';
import { Loading, useToast, Img, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, TASK_STATUS, WORKFLOW_TYPE, fmtTime } from '../labels.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get(`/api/admin/projects/${id}`).then((r) => setData(r.data)).catch((e) => toast(errMsg(e), 'error'));
  }, [id]);

  if (!data) return <Loading />;

  return (
    <div>
      <div className="page-head">
        <h2>项目 #{data.id}</h2>
        <Badge status={data.status} label={PROJECT_STATUS[data.status] || data.status} />
      </div>

      <div className="card card-pad mb16">
        <div className="card-title">基本信息</div>
        <div className="kv"><span className="k">用户</span><Link to={`/admin/users/${data.user_id}`}>{data.user}</Link></div>
        <div className="kv"><span className="k">创建时间</span><span>{fmtTime(data.created_at)}</span></div>
        <div className="kv"><span className="k">参考照片</span><span>{data.reference?.name || (data.user_reference ? '用户上传' : '-')}</span></div>
      </div>

      <div className="two-col">
        <ImageBlock title="参考照片" images={[data.reference, data.user_reference].filter(Boolean)} />
        <ImageBlock title="本人照片" images={data.face ? [data.face] : []} />
      </div>

      <ImageBlock title="洗图候选（✓ 为用户选中）" images={data.wash} showSelected />
      <ImageBlock title="换脸结果" images={data.faceswap} />
      <ImageBlock title="质感优化最终结果" images={data.enhance} />

      <div className="card card-pad mt16">
        <div className="card-title">AI 任务</div>
        <table className="table">
          <thead><tr><th>任务</th><th>类型</th><th>状态</th><th>额度</th><th>时间</th></tr></thead>
          <tbody>
            {data.tasks.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/admin/tasks/${t.id}`}>#{t.id}</Link></td>
                <td>{WORKFLOW_TYPE[t.workflow_type] || t.workflow_type}</td>
                <td><Badge status={t.status} label={TASK_STATUS[t.status] || t.status} /></td>
                <td>{t.credit_cost}</td>
                <td className="small muted">{fmtTime(t.created_at)}</td>
              </tr>
            ))}
            {data.tasks.length === 0 && <tr><td colSpan={5} className="empty">暂无任务</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImageBlock({ title, images, showSelected }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="card card-pad mb16">
      <div className="card-title">{title}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {images.map((img) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <Img src={img.url} style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 8 }} />
            {showSelected && img.selected && (
              <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--primary)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>选中</span>
            )}
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => downloadImage(img.url)}>下载</button>
          </div>
        ))}
      </div>
    </div>
  );
}
