const bcrypt = require('bcryptjs');
const pool = require('../db');

function localDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

exports.getAll = async (req, res) => {
  try {
    const today = localDate();
    // Include current attendance status for each employee
    const [employees] = await pool.query(`
      SELECT u.id, u.name, u.phone, u.role, u.salary, u.is_active, u.created_at,
             a.id as att_id, a.clock_in, a.clock_out, a.total_hours
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ? AND a.clock_out IS NULL
      ORDER BY u.created_at DESC
    `, [today]);
    res.json(employees);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getCount = async (req, res) => {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    res.json({ count: result[0].count });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.add = async (req, res) => {
  try {
    const { name, phone, password, role, salary } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, password_hash, role, salary) VALUES (?, ?, ?, ?, ?)',
      [name, phone, hash, role || 'employee', salary || 0]
    );
    res.status(201).json({ id: result.insertId, name, phone, role: role || 'employee' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Phone number already exists' });
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Employee removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateSalary = async (req, res) => {
  try {
    await pool.query('UPDATE users SET salary = ? WHERE id = ?', [req.body.salary, req.params.id]);
    res.json({ message: 'Salary updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.checkIn = async (req, res) => {
  try {
    let user_id = req.body.user_id;
    if (!user_id || req.user.role !== 'admin') user_id = req.user.id;
    const today = localDate();
    // Check if already clocked in today
    const [existing] = await pool.query(
      'SELECT id FROM attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL', [user_id, today]
    );
    if (existing.length > 0) return res.status(400).json({ message: 'Employee is already checked in' });
    await pool.query('INSERT INTO attendance (user_id, clock_in, date) VALUES (?, NOW(), ?)', [user_id, today]);
    res.json({ message: 'Checked in' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.checkOut = async (req, res) => {
  try {
    let user_id = req.body.user_id;
    if (!user_id || req.user.role !== 'admin') user_id = req.user.id;
    // Find the most recent active check-in session for this user (handles midnight shifts)
    const [records] = await pool.query(
      'SELECT * FROM attendance WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [user_id]
    );
    if (records.length === 0) return res.status(400).json({ message: 'No active check-in found' });
    const hours = ((Date.now() - new Date(records[0].clock_in).getTime()) / 3600000).toFixed(2);
    await pool.query('UPDATE attendance SET clock_out = NOW(), total_hours = ? WHERE id = ?', [hours, records[0].id]);
    res.json({ message: 'Checked out', hours });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAttendance = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    let query = `SELECT a.*, u.name FROM attendance a JOIN users u ON a.user_id = u.id WHERE 1=1`;
    const params = [];
    if (userId) { query += ' AND a.user_id = ?'; params.push(userId); }
    if (startDate) { query += ' AND a.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND a.date <= ?'; params.push(endDate); }
    query += ' ORDER BY a.date DESC, a.clock_in DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getWorkingHours = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Fixed: WHERE before LEFT JOIN filter, only active employees
    let query = `
      SELECT u.id, u.name, u.role,
             COALESCE(SUM(a.total_hours), 0) as total_hours,
             COUNT(DISTINCT a.date) as days_present
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id
        ${startDate && endDate ? 'AND a.date BETWEEN ? AND ?' : ''}
      WHERE u.is_active = 1 AND u.role = 'employee'
      GROUP BY u.id, u.name, u.role
      ORDER BY total_hours DESC
    `;
    const params = startDate && endDate ? [startDate, endDate] : [];
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.paySalary = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, amount, month, paid_date, notes } = req.body;

    // Prevent duplicate salary payments for the same month
    const [existing] = await conn.query('SELECT id FROM salary_payments WHERE user_id = ? AND month = ?', [user_id, month]);
    if (existing.length > 0) {
      throw new Error(`Salary for ${month} has already been paid to this employee.`);
    }

    // Record salary payment
    const [result] = await conn.query(
      'INSERT INTO salary_payments (user_id, amount, month, paid_date, notes) VALUES (?, ?, ?, ?, ?)',
      [user_id, amount, month, paid_date, notes]
    );

    // Fetch employee name for description
    const [[emp]] = await conn.query('SELECT name FROM users WHERE id = ?', [user_id]);
    const empName = emp ? emp.name : `Employee #${user_id}`;
    const description = `Salary to ${empName} — ${month}${notes ? ` (${notes})` : ''}`;

    // Auto-record as expense
    await conn.query(
      'INSERT INTO expenses (amount, category, description, date, created_by) VALUES (?, ?, ?, ?, ?)',
      [amount, 'salary', description, paid_date, req.user.id]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getSalaryHistory = async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT sp.*, u.name FROM salary_payments sp JOIN users u ON sp.user_id = u.id ORDER BY sp.paid_date DESC`
    );
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
