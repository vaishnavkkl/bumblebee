const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');

// Verify Password
async function verifyAdminPassword(userId, password) {
  const [users] = await db.query('SELECT password_hash, role FROM users WHERE id = ?', [userId]);
  if (!users.length || users[0].role !== 'admin') return false;
  const isMatch = await bcrypt.compare(password, users[0].password_hash);
  return isMatch;
}

// Ensure backup dir
async function ensureBackupDir() {
  const backupDir = path.join(__dirname, '..', 'backups');
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return backupDir;
}

// Backup Endpoint
router.post('/backup', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    const [tables] = await db.query('SHOW TABLES');
    
    const backupDir = await ensureBackupDir();
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const fileName = `backup_${dateStr}.json`;
    const filePath = path.join(backupDir, fileName);
    
    // We construct the JSON object table by table to avoid loading everything at once if possible
    // However, JSON.stringify(data) still needs the whole object.
    // For a senior fix, we should use a stream.
    const fileHandle = await fs.open(filePath, 'w');
    await fileHandle.write('{\n');
    
    for (let i = 0; i < tables.length; i++) {
      const tableName = Object.values(tables[i])[0];
      const [rows] = await db.query(`SELECT * FROM ${tableName}`);
      const tableData = JSON.stringify(rows);
      await fileHandle.write(`  "${tableName}": ${tableData}${i === tables.length - 1 ? '' : ','}\n`);
    }
    
    await fileHandle.write('}');
    await fileHandle.close();
    
    res.json({ message: `Backup successfully created at ${filePath}`, filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during backup' });
  }
});

// Clear Data Endpoint
router.post('/clear', auth, async (req, res) => {
  try {
    const { password, type, month } = req.body; 
    if (!(await verifyAdminPassword(req.user.id, password))) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (type === 'full') {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('TRUNCATE TABLE payments');
      await db.query('TRUNCATE TABLE bill_extras');
      await db.query('TRUNCATE TABLE bills');
      await db.query('TRUNCATE TABLE income');
      await db.query('TRUNCATE TABLE expenses');
      await db.query('TRUNCATE TABLE attendance');
      await db.query('TRUNCATE TABLE salary_payments');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      res.json({ message: 'All transactional data fully cleared' });
    } else if (type === 'month' && month) {
      await db.query('DELETE FROM payments WHERE DATE_FORMAT(created_at, "%Y-%m") = ?', [month]);
      await db.query('DELETE FROM bill_extras WHERE bill_id IN (SELECT id FROM bills WHERE DATE_FORMAT(created_at, "%Y-%m") = ?)', [month]);
      await db.query('DELETE FROM bills WHERE DATE_FORMAT(created_at, "%Y-%m") = ?', [month]);
      await db.query('DELETE FROM income WHERE DATE_FORMAT(date, "%Y-%m") = ?', [month]);
      await db.query('DELETE FROM expenses WHERE DATE_FORMAT(date, "%Y-%m") = ?', [month]);
      await db.query('DELETE FROM attendance WHERE DATE_FORMAT(date, "%Y-%m") = ?', [month]);
      await db.query('DELETE FROM salary_payments WHERE month = ?', [month]);
      res.json({ message: `Data for month ${month} cleared` });
    } else {
      res.status(400).json({ message: 'Invalid request parameters' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during data clear' });
  }
});

module.exports = router;
