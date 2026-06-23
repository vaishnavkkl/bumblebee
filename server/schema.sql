-- Bumblebee Car Wash Management System - Database Schema

CREATE DATABASE IF NOT EXISTS bumblebee_db;
USE bumblebee_db;

-- Users (Admin & Employees)
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
);

-- Attendance (Clock In/Out)
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  clock_in DATETIME NOT NULL,
  clock_out DATETIME DEFAULT NULL,
  date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vehicle Types
CREATE TABLE IF NOT EXISTS vehicle_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  label VARCHAR(50) NOT NULL,
  UNIQUE KEY unique_vehicle_type_name (name)
);

-- Services per Vehicle Type
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_type_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  UNIQUE KEY unique_service_vehicle_name (vehicle_type_id, name),
  FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE CASCADE
);

-- Extra Services (universal add-ons)
CREATE TABLE IF NOT EXISTS extra_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  UNIQUE KEY unique_extra_service_name (name)
);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_type_id INT NOT NULL,
  vehicle_number VARCHAR(20) DEFAULT NULL,
  customer_mobile VARCHAR(15) DEFAULT NULL,
  service_id INT NOT NULL,
  service_price DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  advance_amount DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode ENUM('cash', 'account', 'partial') DEFAULT 'cash',
  payment_status ENUM('pending', 'paid') DEFAULT 'pending',
  wash_status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  wash_completed_at DATETIME NULL DEFAULT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Bill Extra Services (many-to-many)
CREATE TABLE IF NOT EXISTS bill_extras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  extra_service_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  UNIQUE KEY unique_bill_extra_service (bill_id, extra_service_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (extra_service_id) REFERENCES extra_services(id)
);

-- Payments
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
);

-- Income
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
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  date DATE NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Salary Payments
CREATE TABLE IF NOT EXISTS salary_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  month VARCHAR(7) NOT NULL,
  paid_date DATE NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed vehicle types
INSERT INTO vehicle_types (name, label) VALUES
  ('bike', 'Bike'),
  ('car', 'Car'),
  ('heavy', 'Heavy Vehicle')
ON DUPLICATE KEY UPDATE label = VALUES(label);

-- Seed services
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Water Wash', 200 FROM vehicle_types WHERE name = 'bike'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Foam Wash', 200 FROM vehicle_types WHERE name = 'bike'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Foam Wash + Lubing', 250 FROM vehicle_types WHERE name = 'bike'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Body Wash', 350 FROM vehicle_types WHERE name = 'car'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Foam Wash', 550 FROM vehicle_types WHERE name = 'car'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Premium Wash', 600 FROM vehicle_types WHERE name = 'car'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'SUV', 700 FROM vehicle_types WHERE name = 'car'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Water Wash', 400 FROM vehicle_types WHERE name = 'heavy'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Foam Wash', 600 FROM vehicle_types WHERE name = 'heavy'
ON DUPLICATE KEY UPDATE price = VALUES(price);
INSERT INTO services (vehicle_type_id, name, price)
SELECT id, 'Foam Wash + Oiling', 800 FROM vehicle_types WHERE name = 'heavy'
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- Seed extra services
INSERT INTO extra_services (name, price) VALUES
  ('Under Body Coating', 2000),
  ('Interior Cleaning', 1500),
  ('Premium Wash', 600),
  ('Steaming', 350),
  ('AC Vent Cleaning', 300),
  ('Polishing', 800),
  ('Painting', 1500)
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- Seed default admin (password: admin123)
INSERT INTO users (name, phone, password_hash, role, salary) VALUES
  ('Admin', '9999999999', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 0)
ON DUPLICATE KEY UPDATE role = VALUES(role), salary = VALUES(salary);
