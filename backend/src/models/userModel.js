const db = require('../config/db');

// Columns that are safe to send to any client.
const PUBLIC_COLUMNS = 'id, name, email, payment_id, role, created_at';

async function findByEmail(email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id, client = db) {
  const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByPaymentId(paymentId, client = db) {
  const { rows } = await client.query('SELECT * FROM users WHERE payment_id = $1', [paymentId]);
  return rows[0] || null;
}

async function publicById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create(client, { name, email, passwordHash, pinHash, paymentId, role }) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, pin_hash, payment_id, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, pinHash, paymentId, role]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, findByPaymentId, publicById, create, PUBLIC_COLUMNS };
