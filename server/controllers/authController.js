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
    // Allow login via phone or name (frontend allows both)
    const [users] = await pool.query(
      'SELECT * FROM users WHERE (phone = ? OR name = ?) AND is_active = 1',
      [phone, phone]
    );
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

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

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    let query = 'UPDATE users SET name = ?, phone = ?';
    let params = [name, phone];
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(hash);
    }
    query += ' WHERE id = ?';
    params.push(req.user.id);
    await pool.query(query, params);
    
    // Generate a new token since the name/phone in the payload changed
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];
    const token = jwt.sign(
      { id: user.id, name: user.name, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ message: 'Profile updated successfully', token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (err) {
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Phone number already exists' });
    res.status(500).json({ message: err.message });
  }
};
