const jwt = require('jsonwebtoken');
const db = require('../db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user is still active in the database
    const [users] = await db.query('SELECT is_active FROM users WHERE id = ?', [decoded.id]);
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

module.exports = { auth, adminOnly };
