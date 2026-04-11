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
    let query = 'SELECT i.*, u.name as created_by_name FROM income i JOIN users u ON i.created_by = u.id WHERE 1=1';
    const params = [];
    if (startDate) { query += ' AND i.date >= ?'; params.push(startDate); }
    if (endDate)   { query += ' AND i.date <= ?'; params.push(endDate); }
    if (type)      { query += ' AND i.type = ?';  params.push(type); }
    query += ' ORDER BY i.date DESC, i.created_at DESC';
    const [records] = await pool.query(query, params);
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
        SUM(CASE WHEN type = 'account' THEN amount ELSE 0 END) as account
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
    query += ' GROUP BY date ORDER BY date ASC';
    const [records] = await pool.query(query, params);
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

exports.getDailyExpenses = async (req, res) => {
  try {
    const { days } = req.query;
    const limit = parseInt(days, 10) || 30;
    const [records] = await pool.query(
      `SELECT date, SUM(amount) as total, category
       FROM expenses WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY date, category ORDER BY date ASC`,
      [limit]
    );
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
