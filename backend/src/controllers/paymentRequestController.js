const v = require('../utils/validate');
const requestModel = require('../models/paymentRequestModel');
const paymentService = require('../services/paymentService');

function shape(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    method: row.method,
    status: row.status,
    sender: { name: row.sender_name, paymentId: row.sender_payment_id },
    receiver: { name: row.receiver_name, paymentId: row.receiver_payment_id },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * The sender scanned a QR code and entered an amount and their PIN.
 * Nothing moves yet — the receiver still has to approve.
 */
async function create(req, res) {
  const receiverPaymentId = v.paymentId(req.body.receiverPaymentId);
  const amount = v.amount(req.body.amount);
  const pin = v.pin(req.body.pin);

  const request = await paymentService.createPaymentRequest({
    senderId: req.user.id,
    receiverPaymentId,
    amount,
    pin,
  });

  res.status(201).json({
    success: true,
    message: `Waiting for ${request.receiver_name} to approve`,
    request: shape(request),
  });
}

async function listReceived(req, res) {
  await requestModel.expireDue();
  const rows = await requestModel.listReceived(req.user.id);
  res.json({ success: true, requests: rows.map(shape) });
}

async function listSent(req, res) {
  await requestModel.expireDue();
  const rows = await requestModel.listSent(req.user.id);
  res.json({ success: true, requests: rows.map(shape) });
}

async function approve(req, res) {
  const id = v.id(req.params.id, 'request id');
  const { request, transaction } = await paymentService.approvePaymentRequest({
    receiverId: req.user.id,
    requestId: id,
  });

  res.json({
    success: true,
    message: 'Transfer complete',
    request: shape(request),
    transaction: {
      id: transaction.id,
      reference: transaction.reference,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      method: transaction.method,
      status: transaction.status,
      createdAt: transaction.created_at,
    },
  });
}

async function reject(req, res) {
  const id = v.id(req.params.id, 'request id');
  const request = await paymentService.rejectPaymentRequest({
    receiverId: req.user.id,
    requestId: id,
  });
  res.json({ success: true, message: 'Request rejected. No money moved.', request: shape(request) });
}

module.exports = { create, listReceived, listSent, approve, reject };
