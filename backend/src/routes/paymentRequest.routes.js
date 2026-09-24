const router = require('express').Router();
const a = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/paymentRequestController');

router.post('/', requireAuth, a(c.create));
router.get('/received', requireAuth, a(c.listReceived));
router.get('/sent', requireAuth, a(c.listSent));
router.patch('/:id/approve', requireAuth, a(c.approve));
router.patch('/:id/reject', requireAuth, a(c.reject));

module.exports = router;
