const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

router.get('/summary', auth, adminOnly, ctrl.getSummary);

module.exports = router;
