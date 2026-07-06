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
router.get('/customers/workshops/kpis', auth, adminOnly, ctrl.getWorkshopKPIs);
router.get('/customers/workshops', auth, adminOnly, ctrl.getWorkshopAnalytics);

module.exports = router;
