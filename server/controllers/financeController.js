const pool = require('../db');

exports.addIncome = async (req, res) => {
  try {
    const { amount, type, source, description, date } = req.body;
    if (!amount || !type || !date) {
      return res.status(400).json({ message: 'amount, type and date are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO income (amount, type, source, description, date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [amount, type, source || 'other', description || null, date, req.user.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getIncome = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    // Regular income query
    let query = `
      SELECT i.id as real_id, CAST(i.id AS CHAR) as id, i.amount, i.type, i.source, i.description, i.date, i.created_at, u.name as created_by_name 
      FROM income i JOIN users u ON i.created_by = u.id WHERE 1=1
    `;
    const params = [];
    if (startDate) { query += ' AND i.date >= ?'; params.push(startDate); }
    if (endDate)   { query += ' AND i.date <= ?'; params.push(endDate); }
    if (type)      { query += ' AND i.type = ?';  params.push(type); }

    // Pending bills query
    let pendingQuery = `
      SELECT NULL as real_id, CONCAT('bill_', b.id) as id, b.balance_amount as amount, 'pending' as type, 'wash' as source, CONCAT('Pending: ', b.vehicle_number) as description, DATE(b.created_at) as date, b.created_at, u.name as created_by_name
      FROM bills b JOIN users u ON b.created_by = u.id 
      WHERE LOWER(b.payment_status) = 'pending' AND b.balance_amount > 0 AND b.wash_status = 'completed'
    `;
    const pendingParams = [];
    if (startDate) { pendingQuery += ' AND DATE(b.created_at) >= ?'; pendingParams.push(startDate); }
    if (endDate)   { pendingQuery += ' AND DATE(b.created_at) <= ?'; pendingParams.push(endDate); }
    
    let finalQuery = query;
    let finalParams = [...params];
    
    if (!type || type === 'pending') {
      if (type === 'pending') {
        finalQuery = pendingQuery;
        finalParams = pendingParams;
      } else {
        finalQuery = `(${query}) UNION ALL (${pendingQuery})`;
        finalParams = [...params, ...pendingParams];
      }
    }
    
    finalQuery += ' ORDER BY date DESC, created_at DESC';

    const [records] = await pool.query(finalQuery, finalParams);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDailyIncome = async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    let query = `
      SELECT date,
        SUM(amount) as total,
        SUM(CASE WHEN type = 'in_hand' THEN amount ELSE 0 END) as in_hand,
        SUM(CASE WHEN type = 'account' THEN amount ELSE 0 END) as account,
        0 as pending
      FROM income WHERE 1=1`;
    const params = [];
    if (startDate && endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      const limit = parseInt(days, 10) || 30;
      query += ' AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      params.push(limit);
    }
    query += ' GROUP BY date';

    let pendingQuery = `
      SELECT DATE(created_at) as date,
        0 as total,
        0 as in_hand,
        0 as account,
        SUM(balance_amount) as pending
      FROM bills
      WHERE payment_status = 'pending' AND balance_amount > 0 AND wash_status = 'completed'
    `;
    const pendingParams = [];
    if (startDate && endDate) {
      pendingQuery += ' AND DATE(created_at) BETWEEN ? AND ?';
      pendingParams.push(startDate, endDate);
    } else {
      const limit = parseInt(days, 10) || 30;
      pendingQuery += ' AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      pendingParams.push(limit);
    }
    pendingQuery += ' GROUP BY DATE(created_at)';

    let finalQuery = `
      SELECT date,
             SUM(total) as total,
             SUM(in_hand) as in_hand,
             SUM(account) as account,
             SUM(pending) as pending
      FROM (
        (${query}) UNION ALL (${pendingQuery})
      ) as combined
      GROUP BY date ORDER BY date ASC
    `;
    
    const [records] = await pool.query(finalQuery, [...params, ...pendingParams]);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM income WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Income record not found' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    const [result] = await pool.query(
      'INSERT INTO expenses (amount, category, description, date, created_by) VALUES (?, ?, ?, ?, ?)',
      [amount, category, description, date, req.user.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = 'SELECT e.*, u.name as created_by_name FROM expenses e JOIN users u ON e.created_by = u.id WHERE 1=1';
    const params = [];
    if (startDate) { query += ' AND e.date >= ?'; params.push(startDate); }
    if (endDate)   { query += ' AND e.date <= ?'; params.push(endDate); }
    if (category)  { query += ' AND e.category = ?'; params.push(category); }
    query += ' ORDER BY e.date DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM expenses WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Expense record not found' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDailyExpenses = async (req, res) => {
  try {
    const { days, startDate, endDate } = req.query;
    let query, params;
    if (startDate && endDate) {
      query = `SELECT date, SUM(amount) as total, category
               FROM expenses WHERE date BETWEEN ? AND ?
               GROUP BY date, category ORDER BY date ASC`;
      params = [startDate, endDate];
    } else {
      const limit = parseInt(days, 10) || 30;
      query = `SELECT date, SUM(amount) as total, category
               FROM expenses WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
               GROUP BY date, category ORDER BY date ASC`;
      params = [limit];
    }
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    const [incomeData] = await pool.query(
      `SELECT COALESCE(source, 'other') as source, SUM(amount) as total
       FROM income WHERE date BETWEEN ? AND ?
       GROUP BY COALESCE(source, 'other') ORDER BY total DESC`,
      [startDate, endDate]
    );
    const [expenseData] = await pool.query(
      `SELECT COALESCE(category, 'other') as category, SUM(amount) as total
       FROM expenses WHERE date BETWEEN ? AND ?
       GROUP BY COALESCE(category, 'other') ORDER BY total DESC`,
      [startDate, endDate]
    );
    const [salaryRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM salary_payments WHERE paid_date BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    const salaryTotal = Number(salaryRows[0]?.total || 0);
    const totalIncome = incomeData.reduce((sum, item) => sum + Number(item.total), 0);
    let totalExpense = expenseData.reduce((sum, item) => sum + Number(item.total), 0);
    if (salaryTotal > 0) {
      totalExpense += salaryTotal;
      expenseData.push({ category: 'Employee Salaries', total: salaryTotal });
    }
    res.json({
      summary: { totalIncome, totalExpense, netBalance: totalIncome - totalExpense },
      incomeBySource: incomeData,
      expenseByCategory: expenseData,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: 'Date range required' });
    if (type === 'income' || type === 'all') {
      await pool.query('DELETE FROM income WHERE date BETWEEN ? AND ?', [startDate, endDate]);
    }
    if (type === 'expenses' || type === 'all') {
      await pool.query('DELETE FROM expenses WHERE date BETWEEN ? AND ?', [startDate, endDate]);
    }
    res.json({ message: `Successfully deleted ${type} data for the selected period.` });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.resetSystem = async (req, res) => {
  try {
    const { confirmPhrase } = req.body;
    if (confirmPhrase !== 'RESET ALL DATA') {
      return res.status(403).json({ message: 'Invalid confirmation phrase' });
    }
    await pool.query('DELETE FROM salary_payments');
    await pool.query('DELETE FROM working_hours');
    await pool.query('DELETE FROM attendance');
    await pool.query('DELETE FROM billing');
    await pool.query('DELETE FROM vehicle_status');
    await pool.query('DELETE FROM vehicle_records');
    await pool.query('DELETE FROM income');
    await pool.query('DELETE FROM expenses');
    await pool.query('DELETE FROM employees');
    res.json({ message: 'System has been fully reset. Only User accounts remain.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
