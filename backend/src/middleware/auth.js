const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const userModel = require('../models/userModel');

/** Verifies the bearer token and attaches the *database* user to the request. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Sign in to continue', 401);
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      throw new AppError('Your session has expired. Sign in again.', 401);
    }

    const user = await userModel.findById(payload.sub);
    if (!user) throw new AppError('Account not found', 401);

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      paymentId: user.payment_id,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('This action is not available for your account type', 403));
  }
  return next();
};

module.exports = { requireAuth, requireRole };
