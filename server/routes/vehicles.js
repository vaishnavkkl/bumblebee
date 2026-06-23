const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/vehicleController');

router.get('/types', auth, ctrl.getVehicleTypes);
router.get('/services', auth, ctrl.getServices);
router.get('/extra-services', auth, ctrl.getExtraServices);
router.post('/services', auth, adminOnly, ctrl.createService);
router.post('/extra-services', auth, adminOnly, ctrl.createExtraService);
router.put('/services/:id/price', auth, adminOnly, ctrl.updateServicePrice);
router.put('/extra-services/:id/price', auth, adminOnly, ctrl.updateExtraServicePrice);
router.delete('/services/:id', auth, adminOnly, ctrl.deleteService);
router.delete('/extra-services/:id', auth, adminOnly, ctrl.deleteExtraService);

module.exports = router;
