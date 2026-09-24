const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const a = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/authController');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/register', authLimiter, a(c.register));
router.post('/login', authLimiter, a(c.login));
router.get('/me', requireAuth, a(c.me));

module.exports = router;
