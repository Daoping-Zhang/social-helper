const express = require('express');
const db = require('../db');
const { signToken, publicUser, verifyPassword, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入账号和密码' });
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  if (row.status !== 'active') return res.status(403).json({ error: '账号已停用，请联系管理员' });
  const token = signToken(row);
  res.json({ token, user: publicUser(row) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
