const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/billingController');

router.post('/', auth, ctrl.createBill);
router.get('/', auth, ctrl.getBills);
router.put('/:id/details', auth, adminOnly, ctrl.updateBillDetails);
router.put('/:id/status', auth, ctrl.updateWashStatus);
router.put('/:id/payment-status', auth, ctrl.updatePaymentStatus);
router.get('/payments', auth, ctrl.getPayments);
router.delete('/payments/:id', auth, adminOnly, ctrl.deletePayment);
router.get('/advance-payments', auth, ctrl.getAdvancePayments);
router.delete('/:id', auth, adminOnly, ctrl.deleteBill);

module.exports = router;
