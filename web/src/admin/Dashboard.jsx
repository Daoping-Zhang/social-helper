import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Loading, useToast, Img, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, WORKFLOW_TYPE, fmtTime } from '../labels.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/api/admin/dashboard').then((r) => setData(r.data)).catch((e) => toast(errMsg(e), 'error'));
  }, []);

  if (!data) return <Loading />;
  const { stats } = data;

  return (
    <div>
      <div className="admin-topbar"><h1>数据总览</h1></div>

      <h3 className="muted small" style={{ margin: '4px 0 10px' }}>用户</h3>
      <div className="stat-grid">
        <Stat v={stats.users.total} l="总用户数" />
        <Stat v={stats.users.today_new} l="今日新增用户" />
        <Stat v={stats.users.today_active} l="今日活跃用户" />
      </div>

      <h3 className="muted small" style={{ margin: '20px 0 10px' }}>生成</h3>
      <div className="stat-grid">
        <Stat v={stats.generation.today_projects} l="今日生成项目" />
        <Stat v={stats.generation.today_wash} l="今日洗图次数" />
        <Stat v={stats.generation.today_faceswap} l="今日换脸次数" />
        <Stat v={stats.generation.today_enhance} l="今日最终优化次数" />
      </div>

      <h3 className="muted small" style={{ margin: '20px 0 10px' }}>AI 服务</h3>
      <div className="stat-grid">
        <Stat v={`${stats.ai.success_rate}%`} l="AI 调用成功率" />
        <Stat v={stats.ai.running} l="当前运行中任务" />
        <Stat v={stats.ai.today_failed} l="今日失败任务" />
        <Stat v={`${stats.ai.avg_seconds.toFixed(1)}s`} l="平均处理时间" />
      </div>

      <h3 className="muted small" style={{ margin: '20px 0 10px' }}>额度</h3>
      <div className="stat-grid">
        <Stat v={stats.credits.today_consumed} l="今日消耗额度" />
        <Stat v={stats.credits.remaining_total} l="用户剩余额度总量" />
      </div>

      <div className="two-col mt16">
        <div className="card card-pad">
          <div className="card-title">最近项目</div>
          {data.recentProjects.length === 0 && <div className="small muted">暂无</div>}
          {data.recentProjects.map((p) => (
            <Link key={p.id} to={`/admin/projects/${p.id}`} className="kv" style={{ color: 'inherit' }}>
              <span className="k">#{p.id} {p.user}</span>
              <Badge status={p.status} label={PROJECT_STATUS[p.status] || p.status} />
            </Link>
          ))}
        </div>
        <div className="card card-pad">
          <div className="card-title">最近失败任务</div>
          {data.recentFailed.length === 0 && <div className="small muted">暂无失败任务</div>}
          {data.recentFailed.map((t) => (
            <Link key={t.id} to={`/admin/tasks/${t.id}`} className="kv" style={{ color: 'inherit' }}>
              <span className="k">#{t.id} {WORKFLOW_TYPE[t.workflow_type]} · {t.error || ''}</span>
              <Badge status="failed" label="失败" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }) {
  return (
    <div className="card stat">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}
