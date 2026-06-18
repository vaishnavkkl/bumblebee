const pool = require('../db');

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
    const { vehicleTypeId } = req.query;
    let query = `
      SELECT
        MIN(c.id) AS id,
        MIN(c.vehicle_type_id) AS vehicle_type_id,
        CASE
          WHEN c.normalized_vehicle_name = 'bike' AND c.service_key = 'foam wash' THEN 'Foam Wash'
          WHEN c.normalized_vehicle_name = 'bike' AND c.service_key = 'water wash' THEN 'Water Wash'
          WHEN c.normalized_vehicle_name = 'bike' AND c.service_key = 'foam wash + lubing' THEN 'Foam Wash + Lubing'
          ELSE MIN(c.service_name)
        END AS name,
        CASE
          WHEN c.normalized_vehicle_name = 'bike' AND c.service_key IN ('water wash', 'foam wash') THEN 200
          WHEN c.normalized_vehicle_name = 'bike' AND c.service_key = 'foam wash + lubing' THEN 250
          ELSE MIN(c.price)
        END AS price,
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
    const [extras] = await pool.query(`
      SELECT MIN(id) AS id, MIN(TRIM(name)) AS name, MIN(price) AS price
      FROM extra_services
      GROUP BY LOWER(TRIM(name))
      ORDER BY MIN(id)
    `);
    res.json(extras);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateServicePrice = async (req, res) => {
  try {
    const { price } = req.body;
    await pool.query('UPDATE services SET price = ? WHERE id = ?', [price, req.params.id]);
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateExtraServicePrice = async (req, res) => {
  try {
    const { price } = req.body;
    await pool.query('UPDATE extra_services SET price = ? WHERE id = ?', [price, req.params.id]);
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
