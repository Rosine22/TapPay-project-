const router = require('express').Router();
const a = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/transactionController');

router.get('/', requireAuth, a(c.list));
router.get('/:id', requireAuth, a(c.getOne));

module.exports = router;
