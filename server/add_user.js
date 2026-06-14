const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
  const name = readArg('name', process.env.ADD_USER_NAME || 'admin').trim();
  const phone = readArg('phone', process.env.ADD_USER_PHONE || name).trim();
  const password = readArg('password', process.env.ADD_USER_PASSWORD || 'admin123');
  const role = readArg('role', process.env.ADD_USER_ROLE || 'admin').trim();
  const salary = Number(readArg('salary', process.env.ADD_USER_SALARY || '0'));

  if (!name || !phone || !password) {
    throw new Error('name, phone, and password are required');
  }

  if (!['admin', 'employee'].includes(role)) {
    throw new Error('role must be admin or employee');
  }

  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error('salary must be a positive number or 0');
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE phone = ? OR name = ? ORDER BY id LIMIT 2',
      [phone, name]
    );

    if (existing.length > 1) {
      throw new Error(`multiple users already match name "${name}" or phone "${phone}"`);
    }

    if (existing.length) {
      await conn.query(
        'UPDATE users SET name = ?, phone = ?, password_hash = ?, role = ?, salary = ?, is_active = 1 WHERE id = ?',
        [name, phone, passwordHash, role, salary, existing[0].id]
      );
      console.log(`Updated active ${role} user: ${name}`);
      return;
    }

    await conn.query(
      'INSERT INTO users (name, phone, password_hash, role, salary, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [name, phone, passwordHash, role, salary]
    );
    console.log(`Created active ${role} user: ${name}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`Failed to add user: ${err.message}`);
  process.exit(1);
});
