const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  console.log('Connected to MySQL. Migrating users...');

  try {
    // 1. Alter users table to increase phone column size so we can store emails
    await conn.query('ALTER TABLE users MODIFY COLUMN phone VARCHAR(100) NOT NULL');
    console.log('Modified users.phone to VARCHAR(100)');
  } catch (err) {
    console.error('Failed to alter users table:', err.message);
  }

  try {
    // 2. Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const employeeHash = await bcrypt.hash('sajith123', 10);

    // 3. Upsert Admin
    const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length > 0) {
      const adminId = admins[0].id;
      await conn.query(
        "UPDATE users SET name = 'Admin', phone = ?, password_hash = ?, is_active = 1 WHERE id = ?",
        ['admin@gmail.com', adminHash, adminId]
      );
      console.log(`Updated admin user (ID: ${adminId}) to admin@gmail.com`);
    } else {
      await conn.query(
        "INSERT INTO users (name, phone, password_hash, role, is_active) VALUES ('Admin', 'admin@gmail.com', ?, 'admin', 1)",
        [adminHash]
      );
      console.log('Inserted new admin user: admin@gmail.com');
    }

    // 4. Upsert Employee (sajith@gmail.com, sajith123)
    const [employees] = await conn.query("SELECT id FROM users WHERE phone = ?", ['sajith@gmail.com']);
    if (employees.length > 0) {
      await conn.query(
        "UPDATE users SET name = 'Sajith', password_hash = ?, is_active = 1 WHERE id = ?",
        [employeeHash, employees[0].id]
      );
      console.log(`Updated employee sajith@gmail.com (ID: ${employees[0].id}) password`);
    } else {
      await conn.query(
        "INSERT INTO users (name, phone, password_hash, role, is_active) VALUES ('Sajith', 'sajith@gmail.com', ?, 'employee', 1)",
        [employeeHash]
      );
      console.log('Inserted new employee user: sajith@gmail.com');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await conn.end();
  }
}

run();
