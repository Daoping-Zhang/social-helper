import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-user">
      <div className="user-shell">
        <div className="user-topbar">
          <div className="brand">男士 AI 写真</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="credits">剩余额度 {user?.credits ?? 0}</span>
            <nav className="nav">
              <NavLink to="/" end>首页</NavLink>
              <NavLink to="/projects">我的作品</NavLink>
              <NavLink to="/account">我的</NavLink>
            </nav>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
