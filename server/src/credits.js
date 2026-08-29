const db = require('./db');

function getCredits(userId) {
  const row = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  return row ? row.credits : 0;
}

// 原子调整额度并记录流水
function changeCredits(userId, delta, reason, { projectId = null, taskId = null } = {}) {
  const tx = db.prepare('UPDATE users SET credits = credits + ?, updated_at = datetime(\'now\') WHERE id = ?');
  tx.run(delta, userId);
  db.prepare(
    `INSERT INTO credit_transactions (user_id, delta, reason, project_id, task_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, delta, reason || null, projectId, taskId);
  return getCredits(userId);
}

function transactionsFor(userId) {
  return db
    .prepare('SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY id DESC')
    .all(userId);
}

function allTransactions() {
  return db.prepare('SELECT * FROM credit_transactions ORDER BY id DESC').all();
}

module.exports = { getCredits, changeCredits, transactionsFor, allTransactions };
