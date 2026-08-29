import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ToastProvider, Loading } from './components/ui.jsx';
import UserLayout from './components/UserLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';

import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import ProjectFlow from './pages/ProjectFlow.jsx';
import Account from './pages/Account.jsx';

import Dashboard from './admin/Dashboard.jsx';
import Users from './admin/Users.jsx';
import UserDetail from './admin/UserDetail.jsx';
import AdminProjects from './admin/Projects.jsx';
import AdminProjectDetail from './admin/ProjectDetail.jsx';
import Tasks from './admin/Tasks.jsx';
import TaskDetail from './admin/TaskDetail.jsx';
import Workflows from './admin/Workflows.jsx';
import WorkflowDetail from './admin/WorkflowDetail.jsx';
import References from './admin/References.jsx';
import Credits from './admin/Credits.jsx';
import Settings from './admin/Settings.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading text="加载中…" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="加载中…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <UserLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectFlow />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/:id" element={<AdminProjectDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="workflows/:type" element={<WorkflowDetail />} />
          <Route path="references" element={<References />} />
          <Route path="credits" element={<Credits />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
