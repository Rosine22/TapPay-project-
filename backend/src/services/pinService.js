const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const ROUNDS = 10;

const hash = (value) => bcrypt.hash(value, ROUNDS);
const compare = (value, digest) => bcrypt.compare(value, digest);

/**
 * Verifies a payment PIN against the stored bcrypt hash.
 * PINs are short, so a wrong PIN counts against a lockout window. The counter
 * lives in the database, never in the client.
 * Always called BEFORE the money transaction opens, so no row locks are held
 * while bcrypt runs.
 */
async function verifyPin(userId, pin) {
  const { rows } = await db.query(
    'SELECT pin_hash, failed_pin_attempts, pin_locked_until FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) throw new AppError('Account not found', 404);

  if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
    throw new AppError('Too many incorrect PIN attempts. Try again in a few minutes.', 429);
  }

  const ok = await compare(pin, user.pin_hash);

  if (!ok) {
    const attempts = user.failed_pin_attempts + 1;
    const locked = attempts >= env.maxPinAttempts;
    await db.query(
      `UPDATE users
       SET failed_pin_attempts = $2,
           pin_locked_until = CASE WHEN $3 THEN now() + interval '15 minutes' ELSE pin_locked_until END
       WHERE id = $1`,
      [userId, locked ? 0 : attempts, locked]
    );
    throw new AppError('Incorrect payment PIN', 401);
  }

  if (user.failed_pin_attempts > 0 || user.pin_locked_until) {
    await db.query(
      'UPDATE users SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = $1',
      [userId]
    );
  }
  return true;
}

module.exports = { hash, compare, verifyPin, ROUNDS };
