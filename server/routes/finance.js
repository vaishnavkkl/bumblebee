const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/financeController');

// Income routes
router.post('/income',          auth, adminOnly, ctrl.addIncome);
router.get('/income',           auth, adminOnly, ctrl.getIncome);
router.get('/income/daily',     auth, adminOnly, ctrl.getDailyIncome);
router.delete('/income/:id',    auth, adminOnly, ctrl.deleteIncome);

// Expense routes
router.post('/expenses',        auth, ctrl.addExpense);
router.get('/expenses',         auth, ctrl.getExpenses);
router.get('/expenses/daily',   auth, ctrl.getDailyExpenses);
router.delete('/expenses/:id',  auth, adminOnly, ctrl.deleteExpense);

// Financial report
router.get('/report',           auth, adminOnly, ctrl.getFinancialReport);

// Admin Maintenance
router.post('/bulk-delete',     auth, adminOnly, ctrl.bulkDelete);
router.post('/reset-system',    auth, adminOnly, ctrl.resetSystem);

module.exports = router;
