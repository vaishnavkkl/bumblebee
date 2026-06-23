const pool = require('../db');

let catalogActiveColumnsReady = false;

async function ensureCatalogActiveColumns() {
  if (catalogActiveColumnsReady) return;

  const [[serviceColumn]] = await pool.query('SHOW COLUMNS FROM services LIKE "is_active"');
  if (!serviceColumn) {
    await pool.query('ALTER TABLE services ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER price');
  }

  const [[extraServiceColumn]] = await pool.query('SHOW COLUMNS FROM extra_services LIKE "is_active"');
  if (!extraServiceColumn) {
    await pool.query('ALTER TABLE extra_services ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER price');
  }

  catalogActiveColumnsReady = true;
}

exports.getVehicleTypes = async (req, res) => {
  try {
    const [types] = await pool.query(`
      SELECT
        MIN(id) AS id,
        CASE normalized_name
          WHEN 'bike' THEN 'bike'
          WHEN 'car' THEN 'car'
          WHEN 'heavy' THEN 'heavy'
          ELSE normalized_name
        END AS name,
        CASE normalized_name
          WHEN 'bike' THEN 'Bike'
          WHEN 'car' THEN 'Car'
          WHEN 'heavy' THEN 'Heavy Vehicle'
          ELSE MIN(TRIM(label))
        END AS label
      FROM (
        SELECT id, LOWER(TRIM(name)) AS normalized_name, label
        FROM vehicle_types
      ) vt
      GROUP BY normalized_name
      ORDER BY MIN(id)
    `);
    res.json(types);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getServices = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const { vehicleTypeId } = req.query;
    let query = `
      SELECT
        MIN(c.id) AS id,
        MIN(c.vehicle_type_id) AS vehicle_type_id,
        SUBSTRING_INDEX(GROUP_CONCAT(c.service_name ORDER BY c.id), ',', 1) AS name,
        CAST(SUBSTRING_INDEX(GROUP_CONCAT(c.price ORDER BY c.id), ',', 1) AS DECIMAL(10,2)) AS price,
        c.normalized_vehicle_name as vehicle_type_name
      FROM (
        SELECT
          s.id,
          s.vehicle_type_id,
          TRIM(s.name) AS service_name,
          s.price,
          LOWER(TRIM(vt.name)) AS normalized_vehicle_name,
          CASE
            WHEN LOWER(TRIM(vt.name)) = 'bike' AND LOWER(TRIM(s.name)) IN ('normal foam wash', 'foam wash') THEN 'foam wash'
            ELSE LOWER(TRIM(s.name))
          END AS service_key
        FROM services s
        JOIN vehicle_types vt ON s.vehicle_type_id = vt.id
        WHERE s.is_active = 1
      ) c
    `;
    const params = [];
    if (vehicleTypeId) {
      query += `
        WHERE c.normalized_vehicle_name = (
          SELECT LOWER(TRIM(name))
          FROM vehicle_types
          WHERE id = ?
          LIMIT 1
        )
      `;
      params.push(vehicleTypeId);
    }
    query += `
      GROUP BY c.normalized_vehicle_name, c.service_key
      ORDER BY MIN(c.id)
    `;
    const [services] = await pool.query(query, params);
    res.json(services);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getExtraServices = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const [extras] = await pool.query(`
      SELECT
        MIN(id) AS id,
        SUBSTRING_INDEX(GROUP_CONCAT(TRIM(name) ORDER BY id), ',', 1) AS name,
        CAST(SUBSTRING_INDEX(GROUP_CONCAT(price ORDER BY id), ',', 1) AS DECIMAL(10,2)) AS price
      FROM (
        SELECT id, LOWER(TRIM(name)) AS normalized_name, name, price
        FROM extra_services
        WHERE is_active = 1
      ) e
      GROUP BY normalized_name
      ORDER BY MIN(id)
    `);
    res.json(extras);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const parsePrice = (price) => {
  const parsed = Number(price);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

exports.createService = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const { vehicle_type_id, name, price } = req.body;
    const serviceName = String(name || '').trim();
    const parsedPrice = parsePrice(price);

    if (!vehicle_type_id) return res.status(400).json({ message: 'Vehicle type is required' });
    if (!serviceName) return res.status(400).json({ message: 'Service name is required' });
    if (parsedPrice === null) return res.status(400).json({ message: 'Enter a valid service cost' });

    const [[vehicleType]] = await pool.query('SELECT id FROM vehicle_types WHERE id = ?', [vehicle_type_id]);
    if (!vehicleType) return res.status(404).json({ message: 'Vehicle type not found' });

    const [[existing]] = await pool.query(
      'SELECT id, is_active FROM services WHERE vehicle_type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
      [vehicle_type_id, serviceName]
    );
    if (existing) {
      if (existing.is_active) {
        return res.status(409).json({ message: 'This service already exists for the selected vehicle type' });
      }

      await pool.query(
        'UPDATE services SET name = ?, price = ?, is_active = 1 WHERE id = ?',
        [serviceName, parsedPrice, existing.id]
      );
      return res.status(200).json({ id: existing.id, message: 'Service restored' });
    }

    const [result] = await pool.query(
      'INSERT INTO services (vehicle_type_id, name, price, is_active) VALUES (?, ?, ?, 1)',
      [vehicle_type_id, serviceName, parsedPrice]
    );
    res.status(201).json({ id: result.insertId, message: 'Service added' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This service already exists for the selected vehicle type' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.createExtraService = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const { name, price } = req.body;
    const serviceName = String(name || '').trim();
    const parsedPrice = parsePrice(price);

    if (!serviceName) return res.status(400).json({ message: 'Extra service name is required' });
    if (parsedPrice === null) return res.status(400).json({ message: 'Enter a valid extra service cost' });

    const [[existing]] = await pool.query(
      'SELECT id, is_active FROM extra_services WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
      [serviceName]
    );
    if (existing) {
      if (existing.is_active) {
        return res.status(409).json({ message: 'This extra service already exists' });
      }

      await pool.query(
        'UPDATE extra_services SET name = ?, price = ?, is_active = 1 WHERE id = ?',
        [serviceName, parsedPrice, existing.id]
      );
      return res.status(200).json({ id: existing.id, message: 'Extra service restored' });
    }

    const [result] = await pool.query(
      'INSERT INTO extra_services (name, price, is_active) VALUES (?, ?, 1)',
      [serviceName, parsedPrice]
    );
    res.status(201).json({ id: result.insertId, message: 'Extra service added' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This extra service already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.updateServicePrice = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const { price } = req.body;
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) return res.status(400).json({ message: 'Enter a valid service cost' });
    await pool.query('UPDATE services SET price = ? WHERE id = ?', [parsedPrice, req.params.id]);
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateExtraServicePrice = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const { price } = req.body;
    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) return res.status(400).json({ message: 'Enter a valid extra service cost' });
    await pool.query('UPDATE extra_services SET price = ? WHERE id = ?', [parsedPrice, req.params.id]);
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteService = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const [result] = await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Service not found' });
    res.json({ message: 'Service deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      const [result] = await pool.query('UPDATE services SET is_active = 0 WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Service not found' });
      return res.json({ message: 'Service removed from active catalog' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.deleteExtraService = async (req, res) => {
  try {
    await ensureCatalogActiveColumns();
    const [result] = await pool.query('DELETE FROM extra_services WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Extra service not found' });
    res.json({ message: 'Extra service deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      const [result] = await pool.query('UPDATE extra_services SET is_active = 0 WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Extra service not found' });
      return res.json({ message: 'Extra service removed from active catalog' });
    }
    res.status(500).json({ message: err.message });
  }
};
