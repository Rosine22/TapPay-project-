const router = require('express').Router();
const a = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/paymentSessionController');

// Only a merchant can ask to be paid.
router.post('/', requireAuth, requireRole('MERCHANT'), a(c.create));
router.get('/mine', requireAuth, requireRole('MERCHANT'), a(c.listMine));
router.get('/:sessionId', requireAuth, a(c.getOne));
// Only a customer can authorise a payment out of their own wallet.
router.post('/:sessionId/authorize', requireAuth, requireRole('CUSTOMER'), a(c.authorize));
router.post('/:sessionId/cancel', requireAuth, requireRole('MERCHANT'), a(c.cancel));

module.exports = router;
