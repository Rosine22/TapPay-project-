const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ success: false, message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Unique violations surface as a readable message rather than a 500.
  if (err.code === '23505') {
    const field = String(err.detail || '').includes('email') ? 'email address' : 'value';
    return res.status(409).json({ success: false, message: `That ${field} is already registered` });
  }
  if (err.code === '23514') {
    return res.status(409).json({ success: false, message: 'The operation was rejected by a database rule' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: err.expose ? err.message : 'Something went wrong on our side',
    code: err.code && err.expose ? err.code : undefined,
    stack: env.nodeEnv === 'development' && status >= 500 ? err.stack : undefined,
  });
}

module.exports = { notFound, errorHandler };
