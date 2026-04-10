const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });

  console.log('Connected to MySQL. Setting up database...');

  await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
  await conn.query(`USE ${process.env.DB_NAME}`);

  // Create tables
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(15) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'employee') DEFAULT 'employee',
      salary DECIMAL(10,2) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      clock_in DATETIME NOT NULL,
      clock_out DATETIME DEFAULT NULL,
      date DATE NOT NULL,
      total_hours DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS vehicle_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      label VARCHAR(50) NOT NULL
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_type_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) DEFAULT 0,
      FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS extra_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) DEFAULT 0
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_type_id INT NOT NULL,
      vehicle_number VARCHAR(20) DEFAULT NULL,
      service_id INT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      paid_amount DECIMAL(10,2) DEFAULT 0,
      advance_amount DECIMAL(10,2) DEFAULT 0,
      balance_amount DECIMAL(10,2) DEFAULT 0,
      payment_mode ENUM('cash', 'account', 'partial') DEFAULT 'cash',
      wash_status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS bill_extras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL,
      extra_service_id INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (extra_service_id) REFERENCES extra_services(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT DEFAULT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_mode ENUM('cash', 'account') DEFAULT 'cash',
      is_advance TINYINT(1) DEFAULT 0,
      notes TEXT DEFAULT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS income (
      id INT AUTO_INCREMENT PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL,
      type ENUM('in_hand', 'account') NOT NULL,
      source VARCHAR(100) DEFAULT 'wash',
      description TEXT DEFAULT NULL,
      date DATE NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT DEFAULT NULL,
      date DATE NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS salary_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      month VARCHAR(7) NOT NULL,
      paid_date DATE NOT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed data - check if already seeded
  const [existingTypes] = await conn.query('SELECT COUNT(*) as c FROM vehicle_types');
  if (existingTypes[0].c === 0) {
    await conn.query(`INSERT INTO vehicle_types (name, label) VALUES ('bike', 'Bike'), ('car', 'Car'), ('heavy', 'Heavy Vehicle')`);
    await conn.query(`INSERT INTO services (vehicle_type_id, name, price) VALUES
      (1, 'Body Wash', 100), (1, 'Foam Wash + Lubing', 200),
      (2, 'Body Wash', 300), (2, 'Foam Wash', 400), (2, 'Premium Wash', 600),
      (3, 'Water Wash', 400), (3, 'Foam Wash', 600), (3, 'Foam Wash + Oiling', 800)`);
    await conn.query(`INSERT INTO extra_services (name, price) VALUES
      ('Under Body Coating', 500), ('Interior Cleaning', 400), ('Premium Wash', 600),
      ('Steaming', 350), ('AC Vent Cleaning', 300), ('Polishing', 800), ('Painting', 1500)`);
    console.log('Seed data inserted.');
  }

  // Create default admin if not exists
  const [existingAdmin] = await conn.query("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
  if (existingAdmin[0].c === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await conn.query("INSERT INTO users (name, phone, password_hash, role) VALUES ('Admin', '9999999999', ?, 'admin')", [hash]);
    console.log('Default admin created: phone=9999999999, password=admin123');
  }

  console.log('Database setup complete!');
  await conn.end();
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
