const pool = require('../db');

let workshopSchemaReady = false;

async function ensureWorkshopSchema(conn = pool) {
  if (workshopSchemaReady) return;

  await conn.query(`
    CREATE TABLE IF NOT EXISTS workshops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      contact_person VARCHAR(100) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_workshop_name (name)
    )
  `);

  const [columns] = await conn.query('SHOW COLUMNS FROM bills LIKE "workshop_id"');
  if (columns.length === 0) {
    await conn.query('ALTER TABLE bills ADD COLUMN workshop_id INT DEFAULT NULL AFTER customer_mobile');
  }

  workshopSchemaReady = true;
}

exports.ensureWorkshopSchema = ensureWorkshopSchema;

exports.getWorkshops = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const includeInactive = req.query.includeInactive === '1' && req.user.role === 'admin';
    const [workshops] = await pool.query(
      `SELECT * FROM workshops
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY is_active DESC, name ASC`
    );
    res.json(workshops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createWorkshop = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const { name, contact_person, phone, address, notes } = req.body;
    const workshopName = String(name || '').trim();
    if (!workshopName) return res.status(400).json({ message: 'Workshop name is required' });

    const [result] = await pool.query(
      `INSERT INTO workshops (name, contact_person, phone, address, notes, is_active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         contact_person = VALUES(contact_person),
         phone = VALUES(phone),
         address = VALUES(address),
         notes = VALUES(notes),
         is_active = 1`,
      [
        workshopName,
        contact_person || null,
        phone || null,
        address || null,
        notes || null,
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Workshop saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateWorkshop = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const { name, contact_person, phone, address, notes, is_active } = req.body;
    const workshopName = String(name || '').trim();
    if (!workshopName) return res.status(400).json({ message: 'Workshop name is required' });

    const [result] = await pool.query(
      `UPDATE workshops
       SET name = ?, contact_person = ?, phone = ?, address = ?, notes = ?, is_active = ?
       WHERE id = ?`,
      [
        workshopName,
        contact_person || null,
        phone || null,
        address || null,
        notes || null,
        is_active === 0 ? 0 : 1,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Workshop not found' });
    res.json({ message: 'Workshop updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Workshop name already exists' });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteWorkshop = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const [result] = await pool.query('UPDATE workshops SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Workshop not found' });
    res.json({ message: 'Workshop removed from active list' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
