const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/billingController');

router.post('/', auth, ctrl.createBill);
router.get('/', auth, ctrl.getBills);
router.put('/:id/status', auth, ctrl.updateWashStatus);
router.get('/payments', auth, ctrl.getPayments);
router.delete('/payments/:id', auth, adminOnly, ctrl.deletePayment);
router.get('/advance-payments', auth, ctrl.getAdvancePayments);

module.exports = router;
