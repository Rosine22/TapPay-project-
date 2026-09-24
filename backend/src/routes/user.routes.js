const router = require('express').Router();
const a = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/userController');

router.get('/me/qr', requireAuth, a(c.getMyQr));
router.get('/payment/:paymentId', requireAuth, a(c.getByPaymentId));

module.exports = router;
