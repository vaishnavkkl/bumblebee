const pool = require('../db');

exports.createBill = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { vehicle_type_id, vehicle_number, customer_mobile, service_id, extra_service_ids, total_amount, paid_amount, advance_amount, payment_mode, created_by } = req.body;
    const billedBy = created_by || req.user.id;
    const balance = total_amount - (paid_amount || 0) - (advance_amount || 0);

    const [result] = await conn.query(
      `INSERT INTO bills (vehicle_type_id, vehicle_number, customer_mobile, service_id, total_amount, paid_amount, advance_amount, balance_amount, payment_mode, wash_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
      [vehicle_type_id, vehicle_number, customer_mobile || null, service_id, total_amount, paid_amount || 0, advance_amount || 0, balance, payment_mode || 'cash', billedBy]
    );

    const billId = result.insertId;

    // Insert extra services
    if (extra_service_ids && extra_service_ids.length > 0) {
      const [extras] = await conn.query('SELECT id, price FROM extra_services WHERE id IN (?)', [extra_service_ids]);
      for (const extra of extras) {
        await conn.query('INSERT INTO bill_extras (bill_id, extra_service_id, price) VALUES (?, ?, ?)', [billId, extra.id, extra.price]);
      }
    }

    // Record payment
    if (paid_amount > 0) {
      await conn.query(
        'INSERT INTO payments (bill_id, amount, payment_mode, is_advance, created_by) VALUES (?, ?, ?, 0, ?)',
        [billId, paid_amount, payment_mode || 'cash', billedBy]
      );
    }
    if (advance_amount > 0) {
      await conn.query(
        'INSERT INTO payments (bill_id, amount, payment_mode, is_advance, created_by) VALUES (?, ?, ?, 1, ?)',
        [billId, advance_amount, payment_mode || 'cash', billedBy]
      );
    }

    // Record income
    const incomeAmount = (paid_amount || 0) + (advance_amount || 0);
    if (incomeAmount > 0) {
      const incomeType = payment_mode === 'account' ? 'account' : 'in_hand';
      await conn.query(
        'INSERT INTO income (amount, type, source, date, created_by) VALUES (?, ?, ?, CURDATE(), ?)',
        [incomeAmount, incomeType, 'wash', billedBy]
      );
    }

    await conn.commit();
    res.status(201).json({ id: billId, message: 'Bill created' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getBills = async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = `SELECT b.*, vt.label as vehicle_type, s.name as service_name, u.name as created_by_name
      FROM bills b
      JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON b.created_by = u.id WHERE 1=1`;
    const params = [];
    if (date) { query += ' AND DATE(b.created_at) = ?'; params.push(date); }
    if (status) { query += ' AND b.wash_status = ?'; params.push(status); }
    query += ' ORDER BY b.created_at DESC';
    const [bills] = await pool.query(query, params);

    // Fetch extras for each bill
    for (let bill of bills) {
      const [extras] = await pool.query(
        `SELECT es.name, be.price FROM bill_extras be JOIN extra_services es ON be.extra_service_id = es.id WHERE be.bill_id = ?`,
        [bill.id]
      );
      bill.extras = extras;
    }
    res.json(bills);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateWashStatus = async (req, res) => {
  try {
    const { status } = req.body;
    let query = 'UPDATE bills SET wash_status = ?';
    const params = [status];
    if (status === 'completed') {
      query += ', wash_completed_at = CURRENT_TIMESTAMP';
    } else {
      query += ', wash_completed_at = NULL'; // in case they revert back to in_progress
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);
    await pool.query(query, params);
    res.json({ message: 'Status updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getPayments = async (req, res) => {
  try {
    const { date } = req.query;
    let query = `SELECT p.*, u.name as created_by_name, b.vehicle_number
      FROM payments p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN bills b ON p.bill_id = b.id WHERE 1=1`;
    const params = [];
    if (date) { query += ' AND DATE(p.created_at) = ?'; params.push(date); }
    query += ' ORDER BY p.created_at DESC';
    const [payments] = await pool.query(query, params);
    res.json(payments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deletePayment = async (req, res) => {
  try {
    await pool.query('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAdvancePayments = async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, u.name as created_by_name, b.vehicle_number, b.total_amount, b.balance_amount
       FROM payments p
       JOIN users u ON p.created_by = u.id
       LEFT JOIN bills b ON p.bill_id = b.id
       WHERE p.is_advance = 1 ORDER BY p.created_at DESC`
    );
    res.json(payments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
