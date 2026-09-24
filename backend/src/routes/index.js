const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/wallet', require('./wallet.routes'));
router.use('/users', require('./user.routes'));
router.use('/payment-sessions', require('./paymentSession.routes'));
router.use('/payment-requests', require('./paymentRequest.routes'));
router.use('/transactions', require('./transaction.routes'));

module.exports = router;
