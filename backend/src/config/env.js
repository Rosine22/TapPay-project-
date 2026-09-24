require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS || 120),
  paymentRequestTtlSeconds: Number(process.env.PAYMENT_REQUEST_TTL_SECONDS || 86400),
  maxPinAttempts: Number(process.env.MAX_PIN_ATTEMPTS || 5),
  currency: 'RWF',
};
