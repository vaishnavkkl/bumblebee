const pool = require('../db');

exports.getVehicleTypes = async (req, res) => {
  try {
    const [types] = await pool.query('SELECT * FROM vehicle_types');
    res.json(types);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getServices = async (req, res) => {
  try {
    const { vehicleTypeId } = req.query;
    let query = 'SELECT s.*, vt.name as vehicle_type_name FROM services s JOIN vehicle_types vt ON s.vehicle_type_id = vt.id';
    const params = [];
    if (vehicleTypeId) { query += ' WHERE s.vehicle_type_id = ?'; params.push(vehicleTypeId); }
    const [services] = await pool.query(query, params);
    res.json(services);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getExtraServices = async (req, res) => {
  try {
    const [extras] = await pool.query('SELECT * FROM extra_services');
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
