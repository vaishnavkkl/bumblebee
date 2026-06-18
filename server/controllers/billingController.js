const pool = require('../db');

exports.createBill = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { vehicle_type_id, vehicle_number, customer_mobile, service_id, extra_service_ids, total_amount, paid_amount, advance_amount, payment_mode, payment_status, created_by } = req.body;
    const billedBy = created_by || req.user.id;
    // Fetch service price for historical accuracy
    const [[service]] = await conn.query('SELECT price FROM services WHERE id = ?', [service_id]);
    const service_price = service ? service.price : 0;
    const balance = total_amount - (paid_amount || 0) - (advance_amount || 0);

    const [result] = await conn.query(
      `INSERT INTO bills (vehicle_type_id, vehicle_number, customer_mobile, service_id, service_price, total_amount, paid_amount, advance_amount, balance_amount, payment_mode, payment_status, wash_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
      [vehicle_type_id, vehicle_number, customer_mobile || null, service_id, service_price, total_amount, paid_amount || 0, advance_amount || 0, balance, payment_mode || 'cash', payment_status || 'pending', billedBy]
    );

    const billId = result.insertId;

    // Insert extra services
    const uniqueExtraServiceIds = [...new Set(extra_service_ids || [])];
    if (uniqueExtraServiceIds.length > 0) {
      const [extras] = await conn.query('SELECT id, price FROM extra_services WHERE id IN (?)', [uniqueExtraServiceIds]);
      for (const extra of extras) {
        await conn.query('INSERT IGNORE INTO bill_extras (bill_id, extra_service_id, price) VALUES (?, ?, ?)', [billId, extra.id, extra.price]);
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
        'INSERT INTO income (amount, type, source, description, date, created_by) VALUES (?, ?, ?, ?, CURDATE(), ?)',
        [incomeAmount, incomeType, 'wash', `Wash: ${vehicle_number}`, billedBy]
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
    const { date, status, payment_status, page, limit: limitStr } = req.query;
    const limit = parseInt(limitStr) || 20;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limit;

    let baseWhere = 'WHERE 1=1';
    const params = [];
    if (date) { baseWhere += ' AND DATE(b.created_at) = ?'; params.push(date); }
    if (status) { baseWhere += ' AND b.wash_status = ?'; params.push(status); }
    if (payment_status) { 
      baseWhere += ' AND LOWER(b.payment_status) = LOWER(?)'; 
      params.push(payment_status); 
    }

    if (payment_status && payment_status.toLowerCase() === 'pending') {
      // Only bills where customer actually owes money
      baseWhere += ' AND b.balance_amount > 0';
    }

    // Get total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bills b JOIN vehicle_types vt ON b.vehicle_type_id = vt.id JOIN services s ON b.service_id = s.id JOIN users u ON b.created_by = u.id ${baseWhere}`,
      params
    );

    const query = `SELECT b.*, vt.label as vehicle_type, s.name as service_name, u.name as created_by_name
      FROM bills b
      JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON b.created_by = u.id ${baseWhere}
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;

    const [bills] = await pool.query(query, [...params, limit, offset]);

    // Fetch extras for each bill
    for (let bill of bills) {
      const [extras] = await pool.query(
        `SELECT COALESCE(es.name, "Deleted Service") as name, be.price
         FROM bill_extras be
         LEFT JOIN extra_services es ON be.extra_service_id = es.id
         WHERE be.bill_id = ?
         GROUP BY COALESCE(es.name, "Deleted Service"), be.price
         ORDER BY MIN(be.id)`,
        [bill.id]
      );
      bill.extras = extras;
    }
    res.json({ data: bills, total, page: pageNum, limit });
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

exports.updatePaymentStatus = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { status, payment_mode } = req.body;
    const billId = req.params.id;

    if (status === 'paid') {
      // 1. Get bill details to calculate payment
      const [[bill]] = await conn.query('SELECT total_amount, balance_amount, vehicle_number FROM bills WHERE id = ?', [billId]);
      if (!bill) throw new Error('Bill not found');
      
      const paymentAmount = bill.balance_amount;
      if (paymentAmount > 0) {
        const mode = payment_mode || 'cash';
        // 2. Record the payment
        await conn.query(
          'INSERT INTO payments (bill_id, amount, payment_mode, is_advance, created_by) VALUES (?, ?, ?, 0, ?)',
          [billId, paymentAmount, mode, req.user.id]
        );

        // 3. Record the income
        const incomeType = mode === 'account' ? 'account' : 'in_hand';
        await conn.query(
          'INSERT INTO income (amount, type, source, description, date, created_by) VALUES (?, ?, ?, ?, CURDATE(), ?)',
          [paymentAmount, incomeType, 'wash', `Balance for ${bill.vehicle_number}`, req.user.id]
        );

        // 4. Update bill totals
        await conn.query(
          'UPDATE bills SET payment_status = ?, paid_amount = total_amount, balance_amount = 0 WHERE id = ?',
          [status, billId]
        );
      } else {
        await conn.query('UPDATE bills SET payment_status = ? WHERE id = ?', [status, billId]);
      }
    } else {
      // Reverting to pending or other status
      await conn.query('UPDATE bills SET payment_status = ? WHERE id = ?', [status, billId]);
    }

    await conn.commit();
    res.json({ message: 'Payment status and records updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { date, page, limit: limitStr } = req.query;
    const limit = parseInt(limitStr) || 20;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limit;

    const params = [];
    let whereClause = 'WHERE 1=1';
    if (date) { whereClause += ' AND DATE(p.created_at) = ?'; params.push(date); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM payments p JOIN users u ON p.created_by = u.id LEFT JOIN bills b ON p.bill_id = b.id ${whereClause}`,
      params
    );

    const [payments] = await pool.query(
      `SELECT p.*, u.name as created_by_name, b.vehicle_number
        FROM payments p
        JOIN users u ON p.created_by = u.id
        LEFT JOIN bills b ON p.bill_id = b.id ${whereClause}
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ data: payments, total, page: pageNum, limit });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deletePayment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const paymentId = req.params.id;

    // 1. Get payment details before deletion
    const [[payment]] = await conn.query('SELECT p.*, b.vehicle_number FROM payments p LEFT JOIN bills b ON p.bill_id = b.id WHERE p.id = ?', [paymentId]);
    if (payment) {
      // 2. Update the bill balances (revert the payment)
      if (payment.bill_id) {
        await conn.query(
          'UPDATE bills SET paid_amount = paid_amount - ?, balance_amount = balance_amount + ?, payment_status = "pending" WHERE id = ?',
          [payment.amount, payment.amount, payment.bill_id]
        );
      }

      // 3. Delete the corresponding income record
      // We match by amount, source='wash' and description containing the vehicle number
      const descMatch = `%${payment.vehicle_number}%`;
      await conn.query(
        'DELETE FROM income WHERE source = "wash" AND amount = ? AND description LIKE ? AND DATE(created_at) = DATE(?)',
        [payment.amount, descMatch, payment.created_at]
      );
    }

    // 4. Delete the payment record
    await conn.query('DELETE FROM payments WHERE id = ?', [paymentId]);
    
    await conn.commit();
    res.json({ message: 'Payment deleted and bill balances reverted' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getAdvancePayments = async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.id, p.amount, IF(p.is_advance=1, 'advance', 'payment') as type, 'wash' as source, CONCAT(IF(p.is_advance=1, 'Advance: ', 'Payment: '), b.vehicle_number) as description, DATE(p.created_at) as date, p.created_at, u.name as created_by_name
       FROM payments p
       JOIN users u ON p.created_by = u.id
       LEFT JOIN bills b ON p.bill_id = b.id
       WHERE p.is_advance = 1 ORDER BY p.created_at DESC`
    );
    res.json(payments);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
