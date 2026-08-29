const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');
const defaults = require('./defaults');

const dbPath = path.join(config.DATA_DIR, 'app.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reference_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '其他',
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference_image_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ready',
  current_stage TEXT DEFAULT 'reference',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  user_id INTEGER,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  selected INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  user_id INTEGER,
  workflow_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  inputs_json TEXT NOT NULL DEFAULT '{}',
  params_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  external_task_id TEXT,
  error TEXT,
  credit_cost INTEGER DEFAULT 0,
  is_test INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  prompt TEXT DEFAULT '',
  negative_prompt TEXT DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  credit_cost INTEGER DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  project_id INTEGER,
  task_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS param_changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_type TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- seed: workflow configs ----
function seedWorkflowConfigs() {
  for (const [type, def] of Object.entries(defaults.workflows)) {
    const exists = db.prepare('SELECT id FROM workflow_configs WHERE workflow_type = ?').get(type);
    if (!exists) {
      db.prepare(
        `INSERT INTO workflow_configs (workflow_type, name, enabled, prompt, negative_prompt, params_json, credit_cost)
         VALUES (?, ?, 1, ?, ?, ?, ?)`
      ).run(type, def.name, def.prompt, def.negative_prompt, JSON.stringify(def.params), def.credit_cost);
    }
  }
}

// ---- seed: settings ----
function seedSettings() {
  for (const [key, value] of Object.entries(defaults.settings)) {
    const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
    if (!exists) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }
  }
}

// ---- seed: admin + demo user ----
function seedUsers() {
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, credits, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('admin', bcrypt.hashSync('admin123', 10), '管理员', 'admin', 0, 'active', '平台管理员');
  }
  const demo = db.prepare('SELECT id FROM users WHERE username = ?').get('zhangsan');
  if (!demo) {
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, credits, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('zhangsan', bcrypt.hashSync('123456', 10), '张三', 'user', 50, 'active', '客户 A（演示账号）');
  }
}

seedWorkflowConfigs();
seedSettings();
seedUsers();

module.exports = db;
