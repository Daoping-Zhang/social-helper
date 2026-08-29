import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api.js';
import { useToast } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(username, password);
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>男士 AI 写真</h1>
        <p>登录以开始生成你的专属写真</p>
        <div className="field">
          <label>账号</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="请输入账号" />
        </div>
        <div className="field">
          <label>密码</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="请输入密码" />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy} type="submit">
          {busy ? '登录中…' : '登录'}
        </button>
        <p className="small" style={{ marginTop: 18, color: '#5a6272' }}>
          演示账号：用户 zhangsan / 123456 · 管理员 admin / admin123
        </p>
      </form>
    </div>
  );
}
