import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const LINKS = [
  { to: '/admin', label: '数据总览', end: true },
  { to: '/admin/users', label: '用户管理' },
  { to: '/admin/projects', label: '生成项目' },
  { to: '/admin/tasks', label: 'AI 任务' },
  { to: '/admin/workflows', label: '工作流' },
  { to: '/admin/references', label: '参考照片' },
  { to: '/admin/credits', label: '额度管理' },
  { to: '/admin/settings', label: '系统设置' },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">AI 写真 · 管理后台</div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
        ))}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-sm btn-ghost" style={{ color: '#cbd5e1', width: '100%' }} onClick={() => navigate('/')}>← 返回用户端</button>
          <button className="btn btn-sm btn-ghost" style={{ color: '#cbd5e1', width: '100%' }} onClick={() => { logout(); navigate('/login'); }}>退出登录</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
