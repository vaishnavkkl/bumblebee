const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    // Add wash_completed_at DATETIME if not exists
    await conn.query(`
      ALTER TABLE bills
      ADD COLUMN wash_completed_at DATETIME NULL DEFAULT NULL
    `);
    console.log('ALTER OK - added wash_completed_at');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('wash_completed_at already exists.');
    } else {
      console.error(err);
    }
  }

  // Also update existing 'pending' bills to 'in_progress' to clean up state
  await conn.query("UPDATE bills SET wash_status = 'in_progress' WHERE wash_status = 'pending'");
  await conn.end();
}

run();
