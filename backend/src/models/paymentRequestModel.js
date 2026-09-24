const db = require('../config/db');

const SELECT_WITH_PARTIES = `
  SELECT pr.*,
         s.name AS sender_name, s.payment_id AS sender_payment_id,
         r.name AS receiver_name, r.payment_id AS receiver_payment_id
  FROM payment_requests pr
  JOIN users s ON s.id = pr.sender_id
  JOIN users r ON r.id = pr.receiver_id`;

async function create({ senderId, receiverId, amount, currency, ttlSeconds }) {
  const { rows } = await db.query(
    `INSERT INTO payment_requests (sender_id, receiver_id, amount, currency, method, status, expires_at)
     VALUES ($1, $2, $3, $4, 'QR', 'PENDING', now() + ($5 || ' seconds')::interval)
     RETURNING id`,
    [senderId, receiverId, amount, currency, String(ttlSeconds)]
  );
  return findById(rows[0].id);
}

async function findById(id) {
  const { rows } = await db.query(`${SELECT_WITH_PARTIES} WHERE pr.id = $1`, [id]);
  return rows[0] || null;
}

async function listReceived(userId, limit = 50) {
  const { rows } = await db.query(
    `${SELECT_WITH_PARTIES} WHERE pr.receiver_id = $1 ORDER BY pr.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function listSent(userId, limit = 50) {
  const { rows } = await db.query(
    `${SELECT_WITH_PARTIES} WHERE pr.sender_id = $1 ORDER BY pr.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function expireDue() {
  await db.query(
    `UPDATE payment_requests SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= now()`
  );
}

// Atomic claim: only one approve can ever win for a given request.
async function claimForApproval(client, id, receiverId) {
  const { rows } = await client.query(
    `UPDATE payment_requests SET status = 'APPROVED'
     WHERE id = $1 AND receiver_id = $2 AND status = 'PENDING' AND expires_at > now()
     RETURNING *`,
    [id, receiverId]
  );
  return rows[0] || null;
}

async function markStatus(client, id, status, transactionId = null) {
  const { rows } = await client.query(
    `UPDATE payment_requests SET status = $2, transaction_id = COALESCE($3, transaction_id)
     WHERE id = $1 RETURNING *`,
    [id, status, transactionId]
  );
  return rows[0] || null;
}

async function reject(id, receiverId) {
  const { rows } = await db.query(
    `UPDATE payment_requests SET status = 'REJECTED'
     WHERE id = $1 AND receiver_id = $2 AND status = 'PENDING'
     RETURNING id`,
    [id, receiverId]
  );
  return rows[0] ? findById(rows[0].id) : null;
}

module.exports = {
  create,
  findById,
  listReceived,
  listSent,
  expireDue,
  claimForApproval,
  markStatus,
  reject,
};
