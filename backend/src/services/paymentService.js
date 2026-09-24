/**
 * The only place in the codebase where money moves.
 *
 * Rules that hold for both flows:
 *  - the amount comes from the database row, never from the request body;
 *  - the payer identity comes from the JWT, never from the request body;
 *  - the PIN is verified server-side before the transaction opens;
 *  - the session / request is claimed with a single conditional UPDATE, so a
 *    replayed request can never produce a second transaction;
 *  - the debit is guarded by `balance >= amount`, so a wallet cannot go negative
 *    even under concurrency.
 */
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const ids = require('../utils/ids');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const sessionModel = require('../models/paymentSessionModel');
const requestModel = require('../models/paymentRequestModel');
const pinService = require('./pinService');

async function moveFunds(client, { senderId, receiverId, amount, currency, method }) {
  const { a: senderWallet, b: receiverWallet } = await walletModel.lockPair(client, senderId, receiverId);

  if (!senderWallet) throw new AppError('Your wallet could not be found', 404);
  if (!receiverWallet) throw new AppError('The receiving wallet could not be found', 404);
  if (senderWallet.currency !== currency || receiverWallet.currency !== currency) {
    throw new AppError('Both wallets must use the same currency', 409);
  }

  // Guarded debit. If the balance moved underneath us, zero rows come back.
  const debit = await client.query(
    'UPDATE wallets SET balance = balance - $2 WHERE user_id = $1 AND balance >= $2 RETURNING balance',
    [senderId, amount]
  );
  if (debit.rowCount === 0) {
    return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
  }

  await client.query('UPDATE wallets SET balance = balance + $2 WHERE user_id = $1', [receiverId, amount]);

  const transaction = await transactionModel.create(client, {
    senderId,
    receiverId,
    amount,
    currency,
    method,
    status: 'COMPLETED',
    reference: ids.transactionReference(),
  });

  return { ok: true, transaction, senderBalance: Number(debit.rows[0].balance) };
}

/* ------------------------------------------------------------------ */
/* NFC / POS flow                                                      */
/* ------------------------------------------------------------------ */

/** What the customer's phone shows after tapping: who is charging, how much. */
async function getSessionForCustomer(sessionId) {
  await sessionModel.expireIfDue(sessionId);
  const session = await sessionModel.findBySessionId(sessionId);
  if (!session) throw new AppError('Payment session not found', 404);
  return session;
}

async function authorizeSession({ customerId, sessionId, pin }) {
  const session = await getSessionForCustomer(sessionId);

  if (session.status !== 'WAITING') {
    throw new AppError(`This payment session is ${session.status.toLowerCase()} and cannot be paid`, 409);
  }
  if (session.merchant_id === customerId) {
    throw new AppError('You cannot pay your own payment request', 409);
  }

  // Slow hash first, outside the transaction, so no rows are locked while it runs.
  await pinService.verifyPin(customerId, pin);

  const result = await db.withTransaction(async (client) => {
    const claimed = await sessionModel.claimForCustomer(client, sessionId, customerId);
    if (!claimed) {
      // Someone (or a retry) already took this session, or it expired.
      throw new AppError('This payment has already been processed or has expired', 409);
    }

    const funds = await moveFunds(client, {
      senderId: customerId,
      receiverId: Number(claimed.merchant_id),
      amount: Number(claimed.amount),
      currency: claimed.currency,
      method: 'NFC',
    });

    if (!funds.ok) {
      // Keep the failure visible to the POS instead of silently rolling back.
      await sessionModel.markStatus(client, sessionId, 'FAILED');
      return { ok: false, reason: funds.reason };
    }

    await sessionModel.markStatus(client, sessionId, 'COMPLETED', funds.transaction.id);
    return { ok: true, transaction: funds.transaction, balance: funds.senderBalance };
  });

  if (!result.ok) {
    throw new AppError('Insufficient wallet balance', 402, 'INSUFFICIENT_FUNDS');
  }

  const merchant = await userModel.publicById(Number(session.merchant_id));
  return {
    transaction: result.transaction,
    balance: result.balance,
    merchant: { name: merchant.name, paymentId: merchant.payment_id },
  };
}

/* ------------------------------------------------------------------ */
/* QR person-to-person flow                                            */
/* ------------------------------------------------------------------ */

/**
 * Step 1 — the sender scans the receiver's QR, enters an amount and their PIN.
 * No money moves here: a PENDING payment request is created and the receiver
 * has to approve it.
 */
async function createPaymentRequest({ senderId, receiverPaymentId, amount, pin }) {
  const receiver = await userModel.findByPaymentId(receiverPaymentId);
  if (!receiver) throw new AppError('No TapPay account matches that code', 404);
  if (receiver.id === senderId) throw new AppError('You cannot send money to yourself', 409);

  await pinService.verifyPin(senderId, pin);

  // Friendly early check. The binding check happens again at approval time.
  const wallet = await walletModel.findByUserId(senderId);
  if (!wallet || Number(wallet.balance) < amount) {
    throw new AppError('Insufficient wallet balance', 402, 'INSUFFICIENT_FUNDS');
  }

  return requestModel.create({
    senderId,
    receiverId: receiver.id,
    amount,
    currency: env.currency,
    ttlSeconds: env.paymentRequestTtlSeconds,
  });
}

/** Step 2 — the receiver approves, and only then are the wallets touched. */
async function approvePaymentRequest({ receiverId, requestId }) {
  await requestModel.expireDue();
  const existing = await requestModel.findById(requestId);
  if (!existing) throw new AppError('Payment request not found', 404);
  if (Number(existing.receiver_id) !== receiverId) {
    throw new AppError('You cannot act on this payment request', 403);
  }
  if (existing.status !== 'PENDING') {
    throw new AppError(`This request is already ${existing.status.toLowerCase()}`, 409);
  }

  const result = await db.withTransaction(async (client) => {
    const claimed = await requestModel.claimForApproval(client, requestId, receiverId);
    if (!claimed) throw new AppError('This request has already been handled or has expired', 409);

    const funds = await moveFunds(client, {
      senderId: Number(claimed.sender_id),
      receiverId: Number(claimed.receiver_id),
      amount: Number(claimed.amount),
      currency: claimed.currency,
      method: 'QR',
    });

    if (!funds.ok) {
      await requestModel.markStatus(client, requestId, 'FAILED');
      return { ok: false, reason: funds.reason };
    }

    await requestModel.markStatus(client, requestId, 'APPROVED', funds.transaction.id);
    return { ok: true, transaction: funds.transaction };
  });

  if (!result.ok) {
    throw new AppError("The sender's wallet no longer has enough money for this transfer", 402, 'INSUFFICIENT_FUNDS');
  }

  const request = await requestModel.findById(requestId);
  return { request, transaction: result.transaction };
}

async function rejectPaymentRequest({ receiverId, requestId }) {
  const rejected = await requestModel.reject(requestId, receiverId);
  if (!rejected) throw new AppError('This request cannot be rejected', 409);
  return rejected;
}

module.exports = {
  moveFunds,
  getSessionForCustomer,
  authorizeSession,
  createPaymentRequest,
  approvePaymentRequest,
  rejectPaymentRequest,
};
