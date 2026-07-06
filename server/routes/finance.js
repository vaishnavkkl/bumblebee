const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/financeController');

// Income routes
router.post('/income',          auth, adminOnly, ctrl.addIncome);
router.get('/income',           auth, adminOnly, ctrl.getIncome);
router.get('/income/daily',     auth, adminOnly, ctrl.getDailyIncome);
router.put('/income/:id',       auth, adminOnly, ctrl.updateIncome);
router.delete('/income/:id',    auth, adminOnly, ctrl.deleteIncome);

// Expense routes
router.post('/expenses',        auth, ctrl.addExpense);
router.get('/expenses',         auth, ctrl.getExpenses);
router.get('/expenses/daily',   auth, ctrl.getDailyExpenses);
router.put('/expenses/:id',     auth, adminOnly, ctrl.updateExpense);
router.delete('/expenses/:id',  auth, adminOnly, ctrl.deleteExpense);
router.get('/expense-categories', auth, ctrl.getExpenseCategories);
router.post('/expense-categories', auth, adminOnly, ctrl.addExpenseCategory);

// Financial report
router.get('/report',           auth, adminOnly, ctrl.getFinancialReport);

// Admin Maintenance
router.post('/bulk-delete',     auth, adminOnly, ctrl.bulkDelete);
router.post('/reset-system',    auth, adminOnly, ctrl.resetSystem);

module.exports = router;
