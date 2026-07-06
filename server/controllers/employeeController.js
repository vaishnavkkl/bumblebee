const bcrypt = require('bcryptjs');
const pool = require('../db');

function localDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

let salaryPaymentColumnsReady = false;

async function ensureSalaryPaymentColumns(conn = pool) {
  if (salaryPaymentColumnsReady) return;

  const [typeColumns] = await conn.query('SHOW COLUMNS FROM salary_payments LIKE "type"');
  if (typeColumns.length === 0) {
    await conn.query("ALTER TABLE salary_payments ADD COLUMN type ENUM('salary', 'advance') DEFAULT 'salary' AFTER amount");
  }

  const [expenseColumns] = await conn.query('SHOW COLUMNS FROM salary_payments LIKE "expense_id"');
  if (expenseColumns.length === 0) {
    await conn.query('ALTER TABLE salary_payments ADD COLUMN expense_id INT DEFAULT NULL AFTER notes');
  }

  salaryPaymentColumnsReady = true;
}

function monthFromDate(value) {
  return String(value || localDate()).slice(0, 7);
}

const parseAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

async function getSalarySummaryRows(conn, month) {
  const [rows] = await conn.query(
    `SELECT
       u.id,
       u.name,
       u.role,
       u.salary,
       u.is_active,
       COALESCE(SUM(CASE WHEN sp.type = 'advance' THEN sp.amount ELSE 0 END), 0) AS advance_paid,
       COALESCE(SUM(CASE WHEN sp.type = 'salary' THEN sp.amount ELSE 0 END), 0) AS salary_paid
     FROM users u
     LEFT JOIN salary_payments sp ON sp.user_id = u.id AND sp.month = ?
     WHERE u.is_active = 1
     GROUP BY u.id, u.name, u.role, u.salary, u.is_active
     ORDER BY u.name ASC`,
    [month]
  );

  return rows.map(row => {
    const salary = Number(row.salary || 0);
    const advancePaid = Number(row.advance_paid || 0);
    const salaryPaid = Number(row.salary_paid || 0);
    const totalPaid = advancePaid + salaryPaid;
    return {
      ...row,
      advance_paid: advancePaid,
      salary_paid: salaryPaid,
      total_paid: totalPaid,
      pending_salary: Math.max(salary - totalPaid, 0),
    };
  });
}

async function autoCheckoutStaleAttendance(conn = pool) {
  await conn.query(`
    UPDATE attendance
    SET clock_out = DATE_ADD(clock_in, INTERVAL 9 HOUR),
        total_hours = 9
    WHERE clock_out IS NULL
      AND TIMESTAMPDIFF(HOUR, clock_in, NOW()) >= 24
  `);
}

exports.getAll = async (req, res) => {
  try {
    await autoCheckoutStaleAttendance();
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
    await autoCheckoutStaleAttendance();
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only admins can manage attendance' });
    const user_id = req.body.user_id;
    if (!user_id) return res.status(400).json({ message: 'Employee is required' });
    const [[employee]] = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [user_id]);
    if (!employee || !employee.is_active) return res.status(404).json({ message: 'Employee not found or inactive' });
    if (employee.role === 'admin') return res.status(400).json({ message: 'Admin attendance is not tracked here' });
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
    await autoCheckoutStaleAttendance();
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only admins can manage attendance' });
    const user_id = req.body.user_id;
    if (!user_id) return res.status(400).json({ message: 'Employee is required' });
    const [[employee]] = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [user_id]);
    if (!employee || !employee.is_active) return res.status(404).json({ message: 'Employee not found or inactive' });
    if (employee.role === 'admin') return res.status(400).json({ message: 'Admin attendance is not tracked here' });
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
    await autoCheckoutStaleAttendance();
    const { userId, startDate, endDate } = req.query;
    let query = `SELECT a.*, u.name FROM attendance a JOIN users u ON a.user_id = u.id WHERE 1=1`;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ' AND a.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      query += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (startDate) { query += ' AND a.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND a.date <= ?'; params.push(endDate); }
    query += ' ORDER BY a.date DESC, a.clock_in DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getWorkingHours = async (req, res) => {
  try {
    await autoCheckoutStaleAttendance();
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
    const description = `Salary to ${empName} - ${month}${notes ? ` (${notes})` : ''}`;

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

exports.paySalary = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureSalaryPaymentColumns(conn);
    await conn.beginTransaction();
    const { user_id, amount, month, paid_date, notes, type = 'salary' } = req.body;
    const paymentType = type === 'advance' ? 'advance' : 'salary';
    const parsedAmount = parseAmount(amount);
    if (!user_id || !month || !paid_date || !parsedAmount) {
      throw new Error('Employee, amount, month and paid date are required.');
    }

    const [[emp]] = await conn.query('SELECT name, salary FROM users WHERE id = ? AND is_active = 1', [user_id]);
    if (!emp) throw new Error('Employee not found or inactive.');

    const [[paidRow]] = await conn.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM salary_payments WHERE user_id = ? AND month = ?',
      [user_id, month]
    );
    const pendingSalary = Math.max(Number(emp.salary || 0) - Number(paidRow.paid || 0), 0);
    if (parsedAmount > pendingSalary) {
      throw new Error(`Amount cannot exceed pending salary of ${pendingSalary}.`);
    }

    const description = `${paymentType === 'advance' ? 'Salary advance' : 'Salary'} to ${emp.name} - ${month}${notes ? ` (${notes})` : ''}`;
    const [expenseResult] = await conn.query(
      'INSERT INTO expenses (amount, category, description, date, created_by) VALUES (?, ?, ?, ?, ?)',
      [parsedAmount, 'salary', description, paid_date, req.user.id]
    );

    const [result] = await conn.query(
      'INSERT INTO salary_payments (user_id, amount, type, month, paid_date, notes, expense_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_id, parsedAmount, paymentType, month, paid_date, notes || null, expenseResult.insertId]
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
    await ensureSalaryPaymentColumns();
    const { month } = req.query;
    const params = [];
    let where = '';
    if (month) {
      where = 'WHERE sp.month = ?';
      params.push(month);
    }
    const [records] = await pool.query(
      `SELECT sp.*, u.name, u.salary
       FROM salary_payments sp
       JOIN users u ON sp.user_id = u.id
       ${where}
       ORDER BY sp.paid_date DESC, sp.id DESC`,
      params
    );
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getSalarySummary = async (req, res) => {
  try {
    await ensureSalaryPaymentColumns();
    const month = req.query.month || monthFromDate();
    const employees = await getSalarySummaryRows(pool, month);
    const totals = employees.reduce((acc, row) => {
      acc.salary += Number(row.salary || 0);
      acc.advance_paid += Number(row.advance_paid || 0);
      acc.salary_paid += Number(row.salary_paid || 0);
      acc.total_paid += Number(row.total_paid || 0);
      acc.pending_salary += Number(row.pending_salary || 0);
      return acc;
    }, { salary: 0, advance_paid: 0, salary_paid: 0, total_paid: 0, pending_salary: 0 });
    res.json({ month, employees, totals });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateSalaryPayment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureSalaryPaymentColumns(conn);
    await conn.beginTransaction();
    const { amount, paid_date, notes } = req.body;
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount || !paid_date) throw new Error('Amount and paid date are required.');

    const [[payment]] = await conn.query(
      `SELECT sp.*, u.name, u.salary
       FROM salary_payments sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = ?`,
      [req.params.id]
    );
    if (!payment) throw new Error('Salary payment not found.');

    const [[paidRow]] = await conn.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM salary_payments WHERE user_id = ? AND month = ? AND id <> ?',
      [payment.user_id, payment.month, payment.id]
    );
    const remainingAllowed = Math.max(Number(payment.salary || 0) - Number(paidRow.paid || 0), 0);
    if (parsedAmount > remainingAllowed) {
      throw new Error(`Amount cannot exceed pending salary of ${remainingAllowed}.`);
    }

    const description = `${payment.type === 'advance' ? 'Salary advance' : 'Salary'} to ${payment.name} - ${payment.month}${notes ? ` (${notes})` : ''}`;
    await conn.query(
      'UPDATE salary_payments SET amount = ?, paid_date = ?, notes = ? WHERE id = ?',
      [parsedAmount, paid_date, notes || null, payment.id]
    );

    if (payment.expense_id) {
      await conn.query(
        'UPDATE expenses SET amount = ?, description = ?, date = ? WHERE id = ?',
        [parsedAmount, description, paid_date, payment.expense_id]
      );
    } else {
      await conn.query(
        `UPDATE expenses
         SET amount = ?, description = ?, date = ?
         WHERE category = 'salary'
           AND amount = ?
           AND date = ?
           AND description LIKE ?
           AND description LIKE ?
         LIMIT 1`,
        [parsedAmount, description, paid_date, payment.amount, payment.paid_date, `%${payment.name}%`, `%${payment.month}%`]
      );
    }

    await conn.commit();
    res.json({ message: 'Salary payment updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.deleteSalaryPayment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureSalaryPaymentColumns(conn);
    await conn.beginTransaction();
    const [[payment]] = await conn.query(
      `SELECT sp.*, u.name
       FROM salary_payments sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = ?`,
      [req.params.id]
    );
    if (!payment) throw new Error('Salary payment not found.');
    await conn.query('DELETE FROM salary_payments WHERE id = ?', [payment.id]);
    if (payment.expense_id) {
      await conn.query('DELETE FROM expenses WHERE id = ?', [payment.expense_id]);
    } else {
      await conn.query(
        `DELETE FROM expenses
         WHERE category = 'salary'
           AND amount = ?
           AND date = ?
           AND description LIKE ?
           AND description LIKE ?
         LIMIT 1`,
        [payment.amount, payment.paid_date, `%${payment.name}%`, `%${payment.month}%`]
      );
    }
    await conn.commit();
    res.json({ message: 'Salary payment deleted' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};
