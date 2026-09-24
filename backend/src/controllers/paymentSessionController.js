const env = require('../config/env');
const AppError = require('../utils/AppError');
const ids = require('../utils/ids');
const v = require('../utils/validate');
const sessionModel = require('../models/paymentSessionModel');
const paymentService = require('../services/paymentService');

/**
 * The shape the POS terminal and the customer phone both see.
 * It carries an amount, a merchant name and a status — nothing sensitive.
 * This object is exactly what the NFC payload points at.
 */
function shape(session) {
  return {
    sessionId: session.session_id,
    merchantId: Number(session.merchant_id),
    merchantName: session.merchant_name,
    customerName: session.customer_name || null,
    amount: Number(session.amount),
    currency: session.currency,
    status: session.status,
    transactionReference: session.transaction_reference || null,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
  };
}

/** POS: "charge 5,000 RWF" — opens a short-lived session and waits for a tap. */
async function create(req, res) {
  const amount = v.amount(req.body.amount);
  const session = await sessionModel.create({
    sessionId: ids.sessionId(),
    merchantId: req.user.id,
    amount,
    currency: env.currency,
    ttlSeconds: env.sessionTtlSeconds,
  });
  const full = await sessionModel.findBySessionId(session.session_id);
  res.status(201).json({ success: true, session: shape(full) });
}

/**
 * Read a session. The POS polls this to follow the status; the customer phone
 * calls it right after the tap to learn who is charging and how much.
 */
async function getOne(req, res) {
  const sessionId = v.sessionId(req.params.sessionId);
  const session = await paymentService.getSessionForCustomer(sessionId);

  // A merchant may only look at their own sessions.
  if (req.user.role === 'MERCHANT' && Number(session.merchant_id) !== req.user.id) {
    throw new AppError('Payment session not found', 404);
  }
  res.json({ success: true, session: shape(session) });
}

/** Customer: confirm with the payment PIN. This is where money moves. */
async function authorize(req, res) {
  const sessionId = v.sessionId(req.params.sessionId);
  const pin = v.pin(req.body.pin);

  const result = await paymentService.authorizeSession({
    customerId: req.user.id,
    sessionId,
    pin,
  });

  res.json({
    success: true,
    message: 'Payment successful',
    transaction: {
      id: result.transaction.id,
      reference: result.transaction.reference,
      amount: Number(result.transaction.amount),
      currency: result.transaction.currency,
      method: result.transaction.method,
      status: result.transaction.status,
      createdAt: result.transaction.created_at,
    },
    merchant: result.merchant,
    balance: result.balance,
  });
}

/** POS: the cashier abandoned the sale. */
async function cancel(req, res) {
  const sessionId = v.sessionId(req.params.sessionId);
  const cancelled = await sessionModel.cancelByMerchant(sessionId, req.user.id);
  if (!cancelled) throw new AppError('This session can no longer be cancelled', 409);
  const full = await sessionModel.findBySessionId(sessionId);
  res.json({ success: true, session: shape(full) });
}

/** POS dashboard: the last few sessions for this merchant. */
async function listMine(req, res) {
  const rows = await sessionModel.listForMerchant(req.user.id, 20);
  res.json({ success: true, sessions: rows.map(shape) });
}

module.exports = { create, getOne, authorize, cancel, listMine };
