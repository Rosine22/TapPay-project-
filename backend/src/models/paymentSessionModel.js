const db = require('../config/db');

const SELECT_WITH_MERCHANT = `
  SELECT ps.*,
         m.name AS merchant_name, m.payment_id AS merchant_payment_id,
         c.name AS customer_name,
         t.reference AS transaction_reference
  FROM payment_sessions ps
  JOIN users m ON m.id = ps.merchant_id
  LEFT JOIN users c ON c.id = ps.customer_id
  LEFT JOIN transactions t ON t.id = ps.transaction_id`;

async function create({ sessionId, merchantId, amount, currency, ttlSeconds }) {
  const { rows } = await db.query(
    `INSERT INTO payment_sessions (session_id, merchant_id, amount, currency, status, expires_at)
     VALUES ($1, $2, $3, $4, 'WAITING', now() + ($5 || ' seconds')::interval)
     RETURNING *`,
    [sessionId, merchantId, amount, currency, String(ttlSeconds)]
  );
  return rows[0];
}

async function findBySessionId(sessionId) {
  const { rows } = await db.query(`${SELECT_WITH_MERCHANT} WHERE ps.session_id = $1`, [sessionId]);
  return rows[0] || null;
}

// Lazily flips a stale WAITING session to EXPIRED when it is read.
async function expireIfDue(sessionId) {
  await db.query(
    `UPDATE payment_sessions SET status = 'EXPIRED'
     WHERE session_id = $1 AND status = 'WAITING' AND expires_at <= now()`,
    [sessionId]
  );
}

// Atomic claim: only one caller can move a session out of WAITING.
// This is the duplicate-payment guard for the NFC/POS flow.
async function claimForCustomer(client, sessionId, customerId) {
  const { rows } = await client.query(
    `UPDATE payment_sessions
     SET status = 'AUTHORIZED', customer_id = $2
     WHERE session_id = $1 AND status = 'WAITING' AND expires_at > now()
     RETURNING *`,
    [sessionId, customerId]
  );
  return rows[0] || null;
}

async function markStatus(client, sessionId, status, transactionId = null) {
  const { rows } = await client.query(
    `UPDATE payment_sessions SET status = $2, transaction_id = COALESCE($3, transaction_id)
     WHERE session_id = $1 RETURNING *`,
    [sessionId, status, transactionId]
  );
  return rows[0] || null;
}

async function cancelByMerchant(sessionId, merchantId) {
  const { rows } = await db.query(
    `UPDATE payment_sessions SET status = 'CANCELLED'
     WHERE session_id = $1 AND merchant_id = $2 AND status = 'WAITING'
     RETURNING *`,
    [sessionId, merchantId]
  );
  return rows[0] || null;
}

async function listForMerchant(merchantId, limit = 20) {
  const { rows } = await db.query(
    `${SELECT_WITH_MERCHANT} WHERE ps.merchant_id = $1 ORDER BY ps.created_at DESC LIMIT $2`,
    [merchantId, limit]
  );
  return rows;
}

module.exports = {
  create,
  findBySessionId,
  expireIfDue,
  claimForCustomer,
  markStatus,
  cancelByMerchant,
  listForMerchant,
};
