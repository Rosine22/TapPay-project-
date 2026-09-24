const AppError = require('../utils/AppError');
const v = require('../utils/validate');
const userModel = require('../models/userModel');

/**
 * Resolves a scanned QR code (or typed TapPay ID) to a display name.
 * Deliberately returns nothing else — no balance, no email, no internal id.
 */
async function getByPaymentId(req, res) {
  const paymentId = v.paymentId(req.params.paymentId);
  const user = await userModel.findByPaymentId(paymentId);
  if (!user) throw new AppError('No TapPay account matches that code', 404);

  res.json({
    success: true,
    user: { name: user.name, paymentId: user.payment_id, role: user.role },
  });
}

// The payload the mobile app renders as a QR image: an identifier and nothing more.
async function getMyQr(req, res) {
  res.json({
    success: true,
    qr: {
      payload: `tappay://pay/${req.user.paymentId}`,
      paymentId: req.user.paymentId,
      name: req.user.name,
    },
  });
}

module.exports = { getByPaymentId, getMyQr };
