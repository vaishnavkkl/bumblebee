const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/workshopController');

router.get('/', auth, ctrl.getWorkshops);
router.post('/', auth, adminOnly, ctrl.createWorkshop);
router.put('/:id', auth, adminOnly, ctrl.updateWorkshop);
router.delete('/:id', auth, adminOnly, ctrl.deleteWorkshop);

module.exports = router;
