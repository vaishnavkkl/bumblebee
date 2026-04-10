const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/employeeController');

router.get('/',               auth,           ctrl.getAll);
router.get('/count',          auth,           ctrl.getCount);
router.post('/',              auth, adminOnly, ctrl.add);
router.delete('/:id',         auth, adminOnly, ctrl.remove);
router.put('/:id/salary',     auth, adminOnly, ctrl.updateSalary);

// Manual attendance (admin can do anyone, employees can do themselves)
router.post('/check-in',      auth,           ctrl.checkIn);
router.post('/check-out',     auth,           ctrl.checkOut);

router.get('/attendance',     auth,           ctrl.getAttendance);
router.get('/working-hours',  auth, adminOnly, ctrl.getWorkingHours);
router.post('/salary-pay',    auth, adminOnly, ctrl.paySalary);
router.get('/salary-history', auth, adminOnly, ctrl.getSalaryHistory);

module.exports = router;
