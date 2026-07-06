const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/workshops', require('./routes/workshops'));
app.use('/api/system', require('./routes/system'));
// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database not ready' });
  }
});

const PORT = process.env.PORT || 5000;

async function waitForDatabase(attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${attempt}/${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Database did not become ready in time');
}

waitForDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Bumblebee server running on http://127.0.0.1:${PORT}`);
    });
  })
  .catch(err => {
    console.error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
