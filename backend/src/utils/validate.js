const AppError = require('./AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4,6}$/;

function str(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') throw new AppError(`${field} is required`, 422);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new AppError(`${field} must be at least ${min} characters`, 422);
  if (trimmed.length > max) throw new AppError(`${field} must be at most ${max} characters`, 422);
  return trimmed;
}

function email(value) {
  const v = str(value, 'Email').toLowerCase();
  if (!EMAIL_RE.test(v)) throw new AppError('Enter a valid email address', 422);
  return v;
}

function password(value) {
  return str(value, 'Password', { min: 8, max: 128 });
}

function pin(value) {
  if (typeof value !== 'string' || !PIN_RE.test(value)) {
    throw new AppError('Payment PIN must be 4 to 6 digits', 422);
  }
  return value;
}

// Amounts are whole RWF. Money never travels as a float.
function amount(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n)) throw new AppError('Amount must be a whole number of RWF', 422);
  if (n <= 0) throw new AppError('Amount must be greater than zero', 422);
  if (n > 100000000) throw new AppError('Amount exceeds the transaction limit', 422);
  return n;
}

function role(value) {
  const v = String(value || 'CUSTOMER').toUpperCase();
  if (!['CUSTOMER', 'MERCHANT'].includes(v)) throw new AppError('Role must be CUSTOMER or MERCHANT', 422);
  return v;
}

function paymentId(value) {
  const v = str(value, 'Payment ID', { min: 4, max: 32 }).toUpperCase();
  if (!/^TP_[A-Z0-9]{4,12}$/.test(v)) throw new AppError('That is not a valid TapPay payment ID', 422);
  return v;
}

function sessionId(value) {
  const v = str(value, 'Session ID', { min: 4, max: 40 }).toUpperCase();
  if (!/^SESSION_[A-Z0-9]{4,16}$/.test(v)) throw new AppError('That is not a valid payment session code', 422);
  return v;
}

function id(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(`Invalid ${field}`, 422);
  return n;
}

module.exports = { str, email, password, pin, amount, role, paymentId, sessionId, id };
