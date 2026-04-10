const db = require('./db');

async function migrate() {
  try {
    console.log('Starting migration...');
    await db.query('ALTER TABLE bills ADD COLUMN customer_mobile VARCHAR(15) DEFAULT NULL AFTER vehicle_number;');
    console.log('Success: customer_mobile added to bills table.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column customer_mobile already exists.');
      process.exit(0);
    }
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
