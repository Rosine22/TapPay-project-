const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const ids = require('../utils/ids');
const v = require('../utils/validate');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const pinService = require('../services/pinService');

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

const shape = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  paymentId: user.payment_id,
  role: user.role,
});

async function uniquePaymentId(client) {
  for (let i = 0; i < 5; i += 1) {
    const candidate = ids.paymentId();
    const { rows } = await client.query('SELECT 1 FROM users WHERE payment_id = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }
  throw new AppError('Could not allocate a payment ID, please try again', 503);
}

/**
 * Registration creates the user and the wallet in one database transaction:
 * an account can never exist without a wallet.
 */
async function register(req, res) {
  const name = v.str(req.body.name, 'Full name', { min: 2, max: 120 });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  const pin = v.pin(req.body.pin);
  const role = v.role(req.body.role);

  const existing = await userModel.findByEmail(email);
  if (existing) throw new AppError('That email address is already registered', 409);

  const [passwordHash, pinHash] = await Promise.all([pinService.hash(password), pinService.hash(pin)]);

  const user = await db.withTransaction(async (client) => {
    const paymentId = await uniquePaymentId(client);
    const created = await userModel.create(client, { name, email, passwordHash, pinHash, paymentId, role });
    await walletModel.createForUser(client, created.id, env.currency);
    return created;
  });

  res.status(201).json({ success: true, token: issueToken(user), user: shape(user) });
}

async function login(req, res) {
  const email = v.email(req.body.email);
  const password = v.str(req.body.password, 'Password');

  const user = await userModel.findByEmail(email);
  // Same message either way, so the endpoint cannot be used to discover accounts.
  const invalid = new AppError('Email or password is incorrect', 401);
  if (!user) {
    await pinService.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalid;
  }
  const ok = await pinService.compare(password, user.password_hash);
  if (!ok) throw invalid;

  res.json({ success: true, token: issueToken(user), user: shape(user) });
}

async function me(req, res) {
  const user = await userModel.publicById(req.user.id);
  res.json({ success: true, user: shape(user) });
}

module.exports = { register, login, me };
