const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function addUniqueIndex(conn, table, indexName, columns) {
  const [indexes] = await conn.query(
    'SHOW INDEX FROM ?? WHERE Key_name = ?',
    [table, indexName]
  );

  if (indexes.length === 0) {
    await conn.query(`ALTER TABLE ?? ADD UNIQUE KEY ?? (${columns})`, [table, indexName]);
  }
}

async function cleanupCatalogDuplicates(conn) {
  await conn.query(`
    CREATE TEMPORARY TABLE vehicle_type_map AS
    SELECT vt.id AS old_id, keepers.keep_id AS new_id
    FROM vehicle_types vt
    JOIN (
      SELECT LOWER(TRIM(name)) AS normalized_name, MIN(id) AS keep_id
      FROM vehicle_types
      GROUP BY LOWER(TRIM(name))
    ) keepers ON LOWER(TRIM(vt.name)) = keepers.normalized_name
  `);

  await conn.query(`
    UPDATE bills b
    JOIN vehicle_type_map m ON b.vehicle_type_id = m.old_id
    SET b.vehicle_type_id = m.new_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query(`
    UPDATE services s
    JOIN vehicle_type_map m ON s.vehicle_type_id = m.old_id
    SET s.vehicle_type_id = m.new_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query(`
    DELETE vt
    FROM vehicle_types vt
    JOIN vehicle_type_map m ON vt.id = m.old_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query('DROP TEMPORARY TABLE vehicle_type_map');

  await conn.query(`
    CREATE TEMPORARY TABLE service_map AS
    SELECT s.id AS old_id, keepers.keep_id AS new_id
    FROM services s
    JOIN (
      SELECT vehicle_type_id, LOWER(TRIM(name)) AS normalized_name, MIN(id) AS keep_id
      FROM services
      GROUP BY vehicle_type_id, LOWER(TRIM(name))
    ) keepers
      ON s.vehicle_type_id = keepers.vehicle_type_id
     AND LOWER(TRIM(s.name)) = keepers.normalized_name
  `);

  await conn.query(`
    UPDATE bills b
    JOIN service_map m ON b.service_id = m.old_id
    SET b.service_id = m.new_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query(`
    DELETE s
    FROM services s
    JOIN service_map m ON s.id = m.old_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query('DROP TEMPORARY TABLE service_map');

  await conn.query(`
    CREATE TEMPORARY TABLE extra_service_map AS
    SELECT e.id AS old_id, keepers.keep_id AS new_id
    FROM extra_services e
    JOIN (
      SELECT LOWER(TRIM(name)) AS normalized_name, MIN(id) AS keep_id
      FROM extra_services
      GROUP BY LOWER(TRIM(name))
    ) keepers ON LOWER(TRIM(e.name)) = keepers.normalized_name
  `);

  await conn.query(`
    UPDATE bill_extras be
    JOIN extra_service_map m ON be.extra_service_id = m.old_id
    SET be.extra_service_id = m.new_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query(`
    DELETE e
    FROM extra_services e
    JOIN extra_service_map m ON e.id = m.old_id
    WHERE m.old_id <> m.new_id
  `);

  await conn.query('DROP TEMPORARY TABLE extra_service_map');

  await conn.query(`
    DELETE be1
    FROM bill_extras be1
    JOIN bill_extras be2
      ON be1.bill_id = be2.bill_id
     AND be1.extra_service_id = be2.extra_service_id
     AND be1.id > be2.id
  `);
}

async function seedCatalog(conn) {
  await conn.query(`
    INSERT INTO vehicle_types (name, label) VALUES
      ('bike', 'Bike'),
      ('car', 'Car'),
      ('heavy', 'Heavy Vehicle')
    ON DUPLICATE KEY UPDATE label = VALUES(label)
  `);

  const [vehicleTypes] = await conn.query('SELECT id, LOWER(TRIM(name)) AS name FROM vehicle_types');
  const vehicleTypeByName = Object.fromEntries(vehicleTypes.map(type => [type.name, type.id]));

  const serviceRows = [
    ['bike', 'Water Wash', 200],
    ['bike', 'Foam Wash', 200],
    ['bike', 'Foam Wash + Lubing', 250],
    ['car', 'Body Wash', 300],
    ['car', 'Foam Wash', 400],
    ['car', 'Premium Wash', 600],
    ['heavy', 'Water Wash', 400],
    ['heavy', 'Foam Wash', 600],
    ['heavy', 'Foam Wash + Oiling', 800],
  ];

  for (const [vehicleTypeName, name, price] of serviceRows) {
    await conn.query(
      `INSERT INTO services (vehicle_type_id, name, price)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [vehicleTypeByName[vehicleTypeName], name, price]
    );
  }

  const extraRows = [
    ['Under Body Coating', 500],
    ['Interior Cleaning', 400],
    ['Premium Wash', 600],
    ['Steaming', 350],
    ['AC Vent Cleaning', 300],
    ['Polishing', 800],
    ['Painting', 1500],
  ];

  for (const [name, price] of extraRows) {
    await conn.query(
      `INSERT INTO extra_services (name, price)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [name, price]
    );
  }
}

async function normalizeService(conn, vehicleTypeName, sourceName, targetName, targetPrice) {
  const [[vehicleType]] = await conn.query('SELECT id FROM vehicle_types WHERE LOWER(TRIM(name)) = ? LIMIT 1', [vehicleTypeName]);
  if (!vehicleType) return;

  if (sourceName === targetName) {
    await conn.query(
      'UPDATE services SET name = ?, price = ? WHERE vehicle_type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))',
      [targetName, targetPrice, vehicleType.id, targetName]
    );
    return;
  }

  const [[target]] = await conn.query(
    'SELECT id FROM services WHERE vehicle_type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id LIMIT 1',
    [vehicleType.id, targetName]
  );
  const [sources] = await conn.query(
    'SELECT id FROM services WHERE vehicle_type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id',
    [vehicleType.id, sourceName]
  );

  if (!sources.length) {
    await conn.query(
      `INSERT INTO services (vehicle_type_id, name, price)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [vehicleType.id, targetName, targetPrice]
    );
    return;
  }

  if (target) {
    const sourceIds = sources.map(service => service.id);
    await conn.query('UPDATE bills SET service_id = ? WHERE service_id IN (?)', [target.id, sourceIds]);
    await conn.query('DELETE FROM services WHERE id IN (?)', [sourceIds]);
    await conn.query('UPDATE services SET price = ? WHERE id = ?', [targetPrice, target.id]);
    return;
  }

  const [keeper, ...duplicateSources] = sources;
  await conn.query(
    'UPDATE services SET name = ?, price = ? WHERE id = ?',
    [targetName, targetPrice, keeper.id]
  );

  if (duplicateSources.length) {
    const duplicateIds = duplicateSources.map(service => service.id);
    await conn.query('UPDATE bills SET service_id = ? WHERE service_id IN (?)', [keeper.id, duplicateIds]);
    await conn.query('DELETE FROM services WHERE id IN (?)', [duplicateIds]);
  }
}

async function normalizeCatalog(conn) {
  await normalizeService(conn, 'bike', 'Body Wash', 'Water Wash', 200);
  await normalizeService(conn, 'bike', 'Normal Foam Wash', 'Foam Wash', 200);
  await normalizeService(conn, 'bike', 'Foam Wash', 'Foam Wash', 200);
  await normalizeService(conn, 'bike', 'Foam Wash + Lubing', 'Foam Wash + Lubing', 250);
}

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
      label VARCHAR(50) NOT NULL,
      UNIQUE KEY unique_vehicle_type_name (name)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_type_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) DEFAULT 0,
      UNIQUE KEY unique_service_vehicle_name (vehicle_type_id, name),
      FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS extra_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) DEFAULT 0,
      UNIQUE KEY unique_extra_service_name (name)
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
      UNIQUE KEY unique_bill_extra_service (bill_id, extra_service_id),
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

  await cleanupCatalogDuplicates(conn);
  await addUniqueIndex(conn, 'vehicle_types', 'unique_vehicle_type_name', 'name');
  await addUniqueIndex(conn, 'services', 'unique_service_vehicle_name', 'vehicle_type_id, name');
  await addUniqueIndex(conn, 'extra_services', 'unique_extra_service_name', 'name');
  await addUniqueIndex(conn, 'bill_extras', 'unique_bill_extra_service', 'bill_id, extra_service_id');

  await normalizeCatalog(conn);
  await seedCatalog(conn);
  console.log('Catalog seed data synced.');

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
