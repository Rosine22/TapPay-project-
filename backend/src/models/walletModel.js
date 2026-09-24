const db = require('../config/db');

async function createForUser(client, userId, currency) {
  const { rows } = await client.query(
    'INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0, $2) RETURNING *',
    [userId, currency]
  );
  return rows[0];
}

async function findByUserId(userId) {
  const { rows } = await db.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// Locks both wallets in a stable order (lowest user_id first) so two payments
// running in opposite directions can never deadlock against each other.
async function lockPair(client, userIdA, userIdB) {
  const { rows } = await client.query(
    `SELECT * FROM wallets WHERE user_id = ANY($1::bigint[]) ORDER BY user_id FOR UPDATE`,
    [[userIdA, userIdB]]
  );
  const byUser = new Map(rows.map((w) => [String(w.user_id), w]));
  return {
    a: byUser.get(String(userIdA)) || null,
    b: byUser.get(String(userIdB)) || null,
  };
}

module.exports = { createForUser, findByUserId, lockPair };
