const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/vehicleController');

router.get('/types', auth, ctrl.getVehicleTypes);
router.get('/services', auth, ctrl.getServices);
router.get('/extra-services', auth, ctrl.getExtraServices);
router.put('/services/:id/price', auth, adminOnly, ctrl.updateServicePrice);
router.put('/extra-services/:id/price', auth, adminOnly, ctrl.updateExtraServicePrice);

module.exports = router;
