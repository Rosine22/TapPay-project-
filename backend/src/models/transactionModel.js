const db = require('../config/db');

async function create(client, { senderId, receiverId, amount, currency, method, status, reference }) {
  const { rows } = await client.query(
    `INSERT INTO transactions (sender_id, receiver_id, amount, currency, method, status, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [senderId, receiverId, amount, currency, method, status, reference]
  );
  return rows[0];
}

const SELECT_WITH_PARTIES = `
  SELECT t.*,
         s.name AS sender_name, s.payment_id AS sender_payment_id,
         r.name AS receiver_name, r.payment_id AS receiver_payment_id
  FROM transactions t
  JOIN users s ON s.id = t.sender_id
  JOIN users r ON r.id = t.receiver_id`;

async function listForUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `${SELECT_WITH_PARTIES}
     WHERE t.sender_id = $1 OR t.receiver_id = $1
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function findByIdForUser(id, userId) {
  const { rows } = await db.query(
    `${SELECT_WITH_PARTIES} WHERE t.id = $1 AND (t.sender_id = $2 OR t.receiver_id = $2)`,
    [id, userId]
  );
  return rows[0] || null;
}

async function todaysTotalReceived(userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total
     FROM transactions
     WHERE receiver_id = $1 AND status = 'COMPLETED' AND created_at::date = CURRENT_DATE`,
    [userId]
  );
  return Number(rows[0].total);
}

module.exports = { create, listForUser, findByIdForUser, todaysTotalReceived };
