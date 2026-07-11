const pool = require('../db');
const { ensureWorkshopSchema } = require('./workshopController');
const { printReceipt } = require('../utils/receiptPrinter');

let discountColumnReady = false;
let catalogActiveColumnsReady = false;

async function ensureDiscountColumn(conn) {
  if (discountColumnReady) return;
  const [columns] = await conn.query('SHOW COLUMNS FROM bills LIKE "discount_amount"');
  if (columns.length === 0) {
    await conn.query('ALTER TABLE bills ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0 AFTER service_price');
  }
  discountColumnReady = true;
}

async function ensureCatalogActiveColumns(conn) {
  if (catalogActiveColumnsReady) return;

  const [[serviceColumn]] = await conn.query('SHOW COLUMNS FROM services LIKE "is_active"');
  if (!serviceColumn) {
    await conn.query('ALTER TABLE services ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER price');
  }

  const [[extraServiceColumn]] = await conn.query('SHOW COLUMNS FROM extra_services LIKE "is_active"');
  if (!extraServiceColumn) {
    await conn.query('ALTER TABLE extra_services ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER price');
  }

  catalogActiveColumnsReady = true;
}

const parseAmount = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  return amount;
};

async function getBillForReceipt(billId) {
  const [[bill]] = await pool.query(
    `SELECT b.*, vt.label as vehicle_type, s.name as service_name, u.name as created_by_name, w.name as workshop_name
     FROM bills b
     JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
     JOIN services s ON b.service_id = s.id
     JOIN users u ON b.created_by = u.id
     LEFT JOIN workshops w ON b.workshop_id = w.id
     WHERE b.id = ?`,
    [billId]
  );

  if (!bill) return null;

  const [extras] = await pool.query(
    `SELECT MIN(be.extra_service_id) as extra_service_id, COALESCE(es.name, "Deleted Service") as name, be.price
     FROM bill_extras be
     LEFT JOIN extra_services es ON be.extra_service_id = es.id
     WHERE be.bill_id = ?
     GROUP BY COALESCE(es.name, "Deleted Service"), be.price
     ORDER BY MIN(be.id)`,
    [bill.id]
  );
  bill.extras = extras;

  return bill;
}

async function applyCompletionDiscount(conn, billId, discountAmount) {
  const discount = parseAmount(discountAmount);
  const [[bill]] = await conn.query(`
    SELECT b.service_price, COALESCE(SUM(be.price), 0) AS extras_total
    FROM bills b
    LEFT JOIN bill_extras be ON be.bill_id = b.id
    WHERE b.id = ?
    GROUP BY b.id, b.service_price
  `, [billId]);

  if (!bill) throw new Error('Bill not found');

  const subtotal = Number(bill.service_price || 0) + Number(bill.extras_total || 0);
  if (discount > subtotal) throw new Error('Discount cannot be more than the service total');

  const totalAmount = subtotal - discount;
  await conn.query(
    `UPDATE bills
     SET discount_amount = ?,
         total_amount = ?,
         balance_amount = GREATEST(? - paid_amount - advance_amount, 0)
     WHERE id = ?`,
    [discount, totalAmount, totalAmount, billId]
  );

  return { subtotal, discount, totalAmount };
}

async function recordBillPayment(conn, billId, amount, paymentMode, userId, vehicleNumber) {
  const paymentAmount = parseAmount(amount);
  if (paymentAmount <= 0) return;

  const mode = paymentMode || 'cash';
  await conn.query(
    'INSERT INTO payments (bill_id, amount, payment_mode, is_advance, created_by) VALUES (?, ?, ?, 0, ?)',
    [billId, paymentAmount, mode, userId]
  );

  const incomeType = mode === 'account' ? 'account' : 'in_hand';
  await conn.query(
    'INSERT INTO income (amount, type, source, description, date, created_by) VALUES (?, ?, ?, ?, CURDATE(), ?)',
    [paymentAmount, incomeType, 'wash', `Wash: ${vehicleNumber || 'No plate'}`, userId]
  );
}

async function applyPaymentStatus(conn, billId, status, paymentMode, userId, paymentAmountInput = null) {
  if (status === 'paid' || status === 'partial') {
    const [[bill]] = await conn.query('SELECT total_amount, paid_amount, advance_amount, balance_amount, vehicle_number FROM bills WHERE id = ?', [billId]);
    if (!bill) throw new Error('Bill not found');

    const currentBalance = Number(bill.balance_amount || 0);
    if (status === 'paid' && currentBalance <= 0) {
      await conn.query('UPDATE bills SET payment_status = "paid", balance_amount = 0 WHERE id = ?', [billId]);
      return;
    }

    const paymentAmount = status === 'partial'
      ? parseAmount(paymentAmountInput)
      : currentBalance;

    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');
    if (paymentAmount > currentBalance) throw new Error('Payment amount cannot be more than the pending balance');
    if (status === 'partial' && paymentAmount >= currentBalance) {
      throw new Error('Partial payment must be less than the pending balance');
    }

    if (paymentAmount > 0) {
      const mode = paymentMode || 'cash';
      await recordBillPayment(conn, billId, paymentAmount, mode, userId, bill.vehicle_number);

      const paidAmount = Number(bill.paid_amount || 0) + paymentAmount;
      const balanceAmount = Math.max(Number(bill.total_amount || 0) - paidAmount - Number(bill.advance_amount || 0), 0);
      const nextStatus = balanceAmount > 0 ? 'pending' : 'paid';
      await conn.query(
        'UPDATE bills SET payment_status = ?, payment_mode = ?, paid_amount = ?, balance_amount = ? WHERE id = ?',
        [nextStatus, mode, paidAmount, balanceAmount, billId]
      );
    }
    return;
  }

  await conn.query('UPDATE bills SET payment_status = "pending" WHERE id = ?', [billId]);
}

exports.createBill = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureDiscountColumn(conn);
    await ensureCatalogActiveColumns(conn);
    await ensureWorkshopSchema(conn);
    await conn.beginTransaction();
    const { vehicle_type_id, vehicle_number, customer_mobile, workshop_id, service_id, extra_service_ids, created_by } = req.body;
    const normalizedVehicleNumber = String(vehicle_number || '').trim();
    if (!normalizedVehicleNumber) {
      await conn.rollback();
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    const billedBy = created_by || req.user.id;
    // Store current catalog price on the bill so future catalog edits do not alter old bills.
    const [[service]] = await conn.query(`
      SELECT s.price
      FROM services s
      WHERE s.id = ? AND s.is_active = 1
    `, [service_id]);
    if (!service) {
      await conn.rollback();
      return res.status(404).json({ message: 'Service not found or inactive' });
    }

    const service_price = Number(service.price || 0);
    let extrasTotal = 0;

    const uniqueExtraServiceIds = [...new Set(extra_service_ids || [])];
    let extras = [];
    if (uniqueExtraServiceIds.length > 0) {
      [extras] = await conn.query(`
        SELECT id, price
        FROM extra_services
        WHERE id IN (?) AND is_active = 1
      `, [uniqueExtraServiceIds]);
      if (extras.length !== uniqueExtraServiceIds.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'One or more extra services are no longer active' });
      }
      extrasTotal = extras.reduce((sum, extra) => sum + Number(extra.price || 0), 0);
    }

    const totalAmount = service_price + extrasTotal;
    const selectedWorkshopId = workshop_id ? Number(workshop_id) : null;
    if (selectedWorkshopId) {
      const [[workshop]] = await conn.query('SELECT id FROM workshops WHERE id = ? AND is_active = 1', [selectedWorkshopId]);
      if (!workshop) {
        await conn.rollback();
        return res.status(400).json({ message: 'Selected workshop is not active' });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO bills (vehicle_type_id, vehicle_number, customer_mobile, workshop_id, service_id, service_price, discount_amount, total_amount, paid_amount, advance_amount, balance_amount, payment_mode, payment_status, wash_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'cash', 'pending', 'in_progress', ?)`,
      [vehicle_type_id, normalizedVehicleNumber, customer_mobile || null, selectedWorkshopId, service_id, service_price, 0, totalAmount, totalAmount, billedBy]
    );

    const billId = result.insertId;

    // Insert extra services
    if (extras.length > 0) {
      for (const extra of extras) {
        await conn.query('INSERT IGNORE INTO bill_extras (bill_id, extra_service_id, price) VALUES (?, ?, ?)', [billId, extra.id, extra.price]);
      }
    }

    await conn.commit();
    res.status(201).json({ id: billId, message: 'Bill created', total_amount: totalAmount, discount_amount: 0 });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getBills = async (req, res) => {
  try {
    await ensureDiscountColumn(pool);
    await ensureWorkshopSchema(pool);
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
      // Only completed bills where customer actually owes money.
      baseWhere += ' AND b.balance_amount > 0 AND b.wash_status = "completed"';
    }

    // Get total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bills b JOIN vehicle_types vt ON b.vehicle_type_id = vt.id JOIN services s ON b.service_id = s.id JOIN users u ON b.created_by = u.id LEFT JOIN workshops w ON b.workshop_id = w.id ${baseWhere}`,
      params
    );

    const query = `SELECT b.*, vt.label as vehicle_type, s.name as service_name, u.name as created_by_name, w.name as workshop_name
      FROM bills b
      JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
      JOIN services s ON b.service_id = s.id
      JOIN users u ON b.created_by = u.id
      LEFT JOIN workshops w ON b.workshop_id = w.id ${baseWhere}
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;

    const [bills] = await pool.query(query, [...params, limit, offset]);

    // Fetch extras for each bill
    for (let bill of bills) {
      const [extras] = await pool.query(
        `SELECT MIN(be.extra_service_id) as extra_service_id, COALESCE(es.name, "Deleted Service") as name, be.price
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
  const conn = await pool.getConnection();
  try {
    await ensureDiscountColumn(conn);
    await conn.beginTransaction();
    const { status, payment_status, payment_mode, discount_amount, paid_amount } = req.body;
    if (!['in_progress', 'completed'].includes(status)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid wash status' });
    }

    if (status !== 'completed' && req.user.role !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ message: 'Only admins can revert completed washes' });
    }

    let query = 'UPDATE bills SET wash_status = ?';
    const params = [status];
    if (status === 'completed') {
      query += ', wash_completed_at = CURRENT_TIMESTAMP';
    } else {
      query += ', wash_completed_at = NULL'; // in case they revert back to in_progress
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);
    await conn.query(query, params);

    if (status === 'completed') {
      await applyCompletionDiscount(conn, req.params.id, discount_amount);
      await applyPaymentStatus(conn, req.params.id, payment_status || 'pending', payment_mode, req.user.id, paid_amount);
    }

    await conn.commit();
    res.json({ message: 'Status updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.updatePaymentStatus = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { status, payment_mode, paid_amount } = req.body;
    const billId = req.params.id;

    await applyPaymentStatus(conn, billId, status, payment_mode, req.user.id, paid_amount);

    await conn.commit();
    res.json({ message: 'Payment status and records updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.printBillReceipt = async (req, res) => {
  try {
    const bill = await getBillForReceipt(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const result = await printReceipt(bill);
    res.json({ message: 'Receipt sent to printer', printer: result.printerName });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to print receipt' });
  }
};

exports.updateBillDetails = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureDiscountColumn(conn);
    await conn.beginTransaction();

    const { vehicle_number, customer_mobile, discount_amount, service_id, extra_service_ids } = req.body;
    const billId = req.params.id;
    const discount = parseAmount(discount_amount);
    const normalizedVehicleNumber = String(vehicle_number || '').trim();
    if (!normalizedVehicleNumber) {
      await conn.rollback();
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    const [[bill]] = await conn.query(`
      SELECT b.vehicle_type_id, b.service_id, b.service_price, b.paid_amount, b.advance_amount, COALESCE(SUM(be.price), 0) AS extras_total
      FROM bills b
      LEFT JOIN bill_extras be ON be.bill_id = b.id
      WHERE b.id = ?
      GROUP BY b.id, b.vehicle_type_id, b.service_id, b.service_price, b.paid_amount, b.advance_amount
    `, [billId]);

    if (!bill) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bill not found' });
    }

    let selectedServiceId = service_id ? Number(service_id) : Number(bill.service_id);
    if (!Number.isInteger(selectedServiceId) || selectedServiceId <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Select a valid service' });
    }

    let servicePrice = Number(bill.service_price || 0);
    if (selectedServiceId !== Number(bill.service_id)) {
      const [[service]] = await conn.query(
        'SELECT id, price FROM services WHERE id = ? AND vehicle_type_id = ? AND is_active = 1',
        [selectedServiceId, bill.vehicle_type_id]
      );
      if (!service) {
        await conn.rollback();
        return res.status(400).json({ message: 'Selected service is not available for this vehicle type' });
      }
      servicePrice = Number(service.price || 0);
    }

    let selectedExtras = [];
    let extrasTotal = 0;
    if (Array.isArray(extra_service_ids)) {
      const uniqueExtraIds = [...new Set(extra_service_ids.map(Number).filter(id => Number.isInteger(id) && id > 0))];
      if (uniqueExtraIds.length !== extra_service_ids.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'Select valid extra services' });
      }

      if (uniqueExtraIds.length > 0) {
        [selectedExtras] = await conn.query(
          'SELECT id, price FROM extra_services WHERE id IN (?) AND is_active = 1',
          [uniqueExtraIds]
        );
        if (selectedExtras.length !== uniqueExtraIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more extra services are not available' });
        }
        extrasTotal = selectedExtras.reduce((sum, extra) => sum + Number(extra.price || 0), 0);
      }
    } else {
      const [currentExtras] = await conn.query('SELECT extra_service_id AS id, price FROM bill_extras WHERE bill_id = ?', [billId]);
      selectedExtras = currentExtras;
      extrasTotal = currentExtras.reduce((sum, extra) => sum + Number(extra.price || 0), 0);
    }

    const subtotal = servicePrice + extrasTotal;
    if (discount > subtotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot be more than the service total' });
    }

    const totalAmount = subtotal - discount;
    const balanceAmount = Math.max(totalAmount - Number(bill.paid_amount || 0) - Number(bill.advance_amount || 0), 0);
    const paymentStatus = balanceAmount > 0 ? 'pending' : 'paid';

    await conn.query(
      `UPDATE bills
       SET vehicle_number = ?,
           customer_mobile = ?,
           service_id = ?,
           service_price = ?,
           discount_amount = ?,
           total_amount = ?,
           balance_amount = ?,
           payment_status = ?
       WHERE id = ?`,
      [normalizedVehicleNumber, customer_mobile || null, selectedServiceId, servicePrice, discount, totalAmount, balanceAmount, paymentStatus, billId]
    );

    if (Array.isArray(extra_service_ids)) {
      await conn.query('DELETE FROM bill_extras WHERE bill_id = ?', [billId]);
      for (const extra of selectedExtras) {
        await conn.query(
          'INSERT INTO bill_extras (bill_id, extra_service_id, price) VALUES (?, ?, ?)',
          [billId, extra.id, extra.price]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Bill details updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { date, month, page, limit: limitStr } = req.query;
    const limit = parseInt(limitStr) || 20;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limit;

    const params = [];
    let whereClause = 'WHERE 1=1';
    if (date) { whereClause += ' AND DATE(p.created_at) = ?'; params.push(date); }
    else if (month) { whereClause += ' AND DATE_FORMAT(p.created_at, "%Y-%m") = ?'; params.push(month); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM payments p JOIN users u ON p.created_by = u.id LEFT JOIN bills b ON p.bill_id = b.id ${whereClause}`,
      params
    );

    const [[filteredStats]] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS amount, COUNT(*) AS count
       FROM payments p ${whereClause}`,
      params
    );

    const [[todayStats]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
       FROM payments
       WHERE DATE(created_at) = CURDATE()`
    );

    const [[monthStats]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
       FROM payments
       WHERE DATE_FORMAT(created_at, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")`
    );

    const [payments] = await pool.query(
      `SELECT
          p.*,
          DATE_FORMAT(p.created_at, '%Y-%m-%d') as payment_date,
          DATE_FORMAT(p.created_at, '%h:%i %p') as payment_time,
          u.name as created_by_name,
          b.vehicle_number
        FROM payments p
        JOIN users u ON p.created_by = u.id
        LEFT JOIN bills b ON p.bill_id = b.id ${whereClause}
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      data: payments,
      total,
      page: pageNum,
      limit,
      stats: {
        filtered: { amount: Number(filteredStats.amount || 0), count: Number(filteredStats.count || 0) },
        today: { amount: Number(todayStats.amount || 0), count: Number(todayStats.count || 0) },
        month: { amount: Number(monthStats.amount || 0), count: Number(monthStats.count || 0) },
      },
    });
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

exports.deleteBill = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const billId = req.params.id;

    const [[bill]] = await conn.query('SELECT id, vehicle_number FROM bills WHERE id = ?', [billId]);
    if (!bill) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bill not found' });
    }

    const [payments] = await conn.query('SELECT * FROM payments WHERE bill_id = ?', [billId]);
    for (const payment of payments) {
      const descMatch = bill.vehicle_number ? `%${bill.vehicle_number}%` : '%No plate%';
      await conn.query(
        'DELETE FROM income WHERE source = "wash" AND amount = ? AND description LIKE ? AND DATE(created_at) = DATE(?)',
        [payment.amount, descMatch, payment.created_at]
      );
    }

    await conn.query('DELETE FROM payments WHERE bill_id = ?', [billId]);
    await conn.query('DELETE FROM bills WHERE id = ?', [billId]);

    await conn.commit();
    res.json({ message: 'Bill deleted' });
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
