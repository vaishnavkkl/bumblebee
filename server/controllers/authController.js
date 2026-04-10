const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

function localDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    // Support login by phone number OR by name
    const [users] = await pool.query(
      'SELECT * FROM users WHERE (phone = ? OR name = ?) AND is_active = 1',
      [phone, phone]
    );
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Auto clock-in on login (only once per day, only if no open session exists)
    const today = localDate();
    const [existing] = await pool.query(
      'SELECT id FROM attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL', [user.id, today]
    );
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO attendance (user_id, clock_in, date) VALUES (?, NOW(), ?)', [user.id, today]
      );
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.logout = async (req, res) => {
  try {
    const today = localDate();
    const [records] = await pool.query(
      'SELECT * FROM attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, today]
    );
    if (records.length > 0) {
      const hours = ((Date.now() - new Date(records[0].clock_in).getTime()) / 3600000).toFixed(2);
      await pool.query(
        'UPDATE attendance SET clock_out = NOW(), total_hours = ? WHERE id = ?',
        [hours, records[0].id]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.me = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, phone, role, salary, created_at FROM users WHERE id = ?', [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(users[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
