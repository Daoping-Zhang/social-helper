const crypto = require('crypto');
const path = require('path');
const config = require('./config');

const uuid = () => crypto.randomUUID();

// 相对 DATA_DIR 的路径 -> 对外 URL
function relToUrl(rel) {
  if (!rel) return '';
  const p = rel.split(path.sep).join('/');
  return '/files/' + p.replace(/^\/+/, '');
}

// 相对 DATA_DIR 的路径 -> 绝对磁盘路径
function absPath(rel) {
  return path.join(config.DATA_DIR, rel);
}

// 绝对磁盘路径 -> 相对 DATA_DIR 的路径（统一使用 /）
function toRel(abs) {
  const rel = path.relative(config.DATA_DIR, abs);
  return rel.split(path.sep).join('/');
}

function safeJson(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

// 包装异步路由，捕获错误交给统一错误处理
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { uuid, relToUrl, absPath, toRel, safeJson, asyncHandler };
