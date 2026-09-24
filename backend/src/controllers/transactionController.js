const AppError = require('../utils/AppError');
const v = require('../utils/validate');
const transactionModel = require('../models/transactionModel');

function shape(row, userId) {
  const outgoing = Number(row.sender_id) === userId;
  return {
    id: row.id,
    reference: row.reference,
    amount: Number(row.amount),
    currency: row.currency,
    method: row.method,
    status: row.status,
    direction: outgoing ? 'OUT' : 'IN',
    counterparty: outgoing
      ? { name: row.receiver_name, paymentId: row.receiver_payment_id }
      : { name: row.sender_name, paymentId: row.sender_payment_id },
    createdAt: row.created_at,
  };
}

async function list(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const rows = await transactionModel.listForUser(req.user.id, { limit, offset });
  res.json({ success: true, transactions: rows.map((r) => shape(r, req.user.id)) });
}

async function getOne(req, res) {
  const id = v.id(req.params.id, 'transaction id');
  const row = await transactionModel.findByIdForUser(id, req.user.id);
  if (!row) throw new AppError('Transaction not found', 404);
  res.json({ success: true, transaction: shape(row, req.user.id) });
}

module.exports = { list, getOne };
