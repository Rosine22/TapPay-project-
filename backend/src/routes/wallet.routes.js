const router = require('express').Router();
const a = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/walletController');

router.get('/', requireAuth, a(c.getWallet));
router.get('/merchant-summary', requireAuth, requireRole('MERCHANT'), a(c.getMerchantSummary));

module.exports = router;
