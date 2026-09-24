const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const db = require('./config/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Mobile apps send no Origin header; browsers must be on the allow list.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, service: 'tappay-backend', database: 'up' });
  } catch (err) {
    res.status(503).json({ success: false, service: 'tappay-backend', database: 'down' });
  }
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

// Housekeeping: sessions and requests also expire lazily when they are read,
// this just keeps the tables tidy for anyone browsing them.
const sweep = setInterval(async () => {
  try {
    await db.query(
      `UPDATE payment_sessions SET status = 'EXPIRED' WHERE status = 'WAITING' AND expires_at <= now()`
    );
    await db.query(
      `UPDATE payment_requests SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= now()`
    );
  } catch (err) {
    console.error('Expiry sweep failed', err.message);
  }
}, 60000);
sweep.unref();

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`TapPay backend listening on http://localhost:${env.port}`);
  });
}

module.exports = app;
