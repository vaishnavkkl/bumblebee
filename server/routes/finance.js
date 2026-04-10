const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/financeController');

router.post('/income', auth, ctrl.addIncome);
router.get('/income', auth, adminOnly, ctrl.getIncome);
router.get('/income/daily', auth, adminOnly, ctrl.getDailyIncome);
router.post('/expenses', auth, ctrl.addExpense);
router.get('/expenses', auth, ctrl.getExpenses);
router.get('/expenses/daily', auth, ctrl.getDailyExpenses);

module.exports = router;
