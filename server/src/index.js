const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { startPolling } = require('./aiService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// 图片文件（仅白名单目录，避免暴露 app.db / .mock）
app.use('/files/uploads', express.static(config.UPLOAD_DIR));
app.use('/files/generated', express.static(config.GENERATED_DIR));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 前端静态资源 + SPA 回退
app.use(express.static(config.PUBLIC_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/files')) return next();
  const index = path.join(config.PUBLIC_DIR, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Frontend not built. Run: npm run build:web');
});

// 统一错误处理
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || '服务器错误' });
});

app.listen(config.PORT, () => {
  console.log(`AI Portrait Platform running at http://localhost:${config.PORT}`);
  console.log(`Data dir: ${config.DATA_DIR}`);
  console.log(`AI Provider: ${config.AI_PROVIDER}`);
  startPolling();
});
