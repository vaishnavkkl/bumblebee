const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/customers', auth, adminOnly, ctrl.getCustomerAnalytics);
router.get('/customers/kpis', auth, adminOnly, ctrl.getCustomerKPIs);
router.get('/customers/trend', auth, adminOnly, ctrl.getVisitTrend);
router.get('/customers/top', auth, adminOnly, ctrl.getTopCustomers);
router.get('/customers/frequency', auth, adminOnly, ctrl.getFrequencyDistribution);
router.get('/customers/services', auth, adminOnly, ctrl.getServicePopularity);

module.exports = router;
