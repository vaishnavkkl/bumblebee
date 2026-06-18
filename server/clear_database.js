const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const tablesToClear = [
  'payments',
  'bill_extras',
  'bills',
  'income',
  'expenses',
  'attendance',
  'salary_payments',
  // Old-version table names. These are skipped automatically when absent.
  'working_hours',
  'billing',
  'vehicle_status',
  'vehicle_records',
];

async function tableExists(conn, tableName) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function main() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('Missing DB_HOST, DB_USER, or DB_NAME in server/.env');
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT || 3306,
  });

  try {
    console.log(`Connected to database: ${DB_NAME}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const tableName of tablesToClear) {
      if (!(await tableExists(conn, tableName))) {
        console.log(`Skipped missing table: ${tableName}`);
        continue;
      }

      await conn.query(`TRUNCATE TABLE \`${tableName}\``);
      console.log(`Cleared table: ${tableName}`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Done.');
  } catch (error) {
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch {}
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`Failed to clear database: ${error.message}`);
  process.exit(1);
});
