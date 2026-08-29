const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    credits: row.credits,
    status: row.status,
    note: row.note,
    created_at: row.created_at,
  };
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// 认证中间件
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const payload = verifyToken(token);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!row) return res.status(401).json({ error: '用户不存在' });
    if (row.status !== 'active') return res.status(403).json({ error: '账号已停用' });
    req.user = row;
    next();
  } catch (_) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  publicUser,
  verifyPassword,
  hashPassword,
  requireAuth,
  requireAdmin,
};
