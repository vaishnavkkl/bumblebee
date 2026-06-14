const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bumblebee',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function migrate() {
  try {
    console.log('Adding service_price to bills table...');
    await pool.query('ALTER TABLE bills ADD COLUMN service_price DECIMAL(10,2) AFTER service_id');
    console.log('Success!');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') console.log('Column already exists.');
    else console.error('Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
