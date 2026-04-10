const pool = require('../db');

exports.addIncome = async (req, res) => {
  try {
    const { amount, type, source, description, date } = req.body;
    const [result] = await pool.query(
      'INSERT INTO income (amount, type, source, description, date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [amount, type, source || 'other', description, date, req.user.id]
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
    if (endDate) { query += ' AND i.date <= ?'; params.push(endDate); }
    if (type) { query += ' AND i.type = ?'; params.push(type); }
    query += ' ORDER BY i.date DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDailyIncome = async (req, res) => {
  try {
    const { days } = req.query;
    const limit = days || 30;
    const [records] = await pool.query(
      `SELECT date, SUM(amount) as total,
        SUM(CASE WHEN type = 'in_hand' THEN amount ELSE 0 END) as in_hand,
        SUM(CASE WHEN type = 'account' THEN amount ELSE 0 END) as account
       FROM income WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY date ORDER BY date ASC`, [limit]
    );
    res.json(records);
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
    if (endDate) { query += ' AND e.date <= ?'; params.push(endDate); }
    if (category) { query += ' AND e.category = ?'; params.push(category); }
    query += ' ORDER BY e.date DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDailyExpenses = async (req, res) => {
  try {
    const { days } = req.query;
    const limit = days || 30;
    const [records] = await pool.query(
      `SELECT date, SUM(amount) as total, category
       FROM expenses WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY date, category ORDER BY date ASC`, [limit]
    );
    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
