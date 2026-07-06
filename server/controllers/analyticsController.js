const pool = require('../db');
const { ensureWorkshopSchema } = require('./workshopController');

exports.getCustomerAnalytics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'All';

    // Build base subquery with search by mobile or vehicle
    const searchParam = search ? [`%${search}%`, `%${search}%`] : [];
    const searchClause = search ? 'AND (b.customer_mobile LIKE ? OR b.vehicle_number LIKE ?)' : '';

    // Subquery that gets all customers with their computed fields
    const baseQuery = `
      SELECT 
        b.customer_mobile,
        COUNT(b.id) AS visit_count,
        SUM(b.total_amount) AS total_spent,
        AVG(b.total_amount) AS avg_spend,
        MIN(b.created_at) AS first_visit,
        MAX(b.created_at) AS last_visit,
        DATEDIFF(NOW(), MAX(b.created_at)) AS days_since_last_visit,
        DATEDIFF(MAX(b.created_at), MIN(b.created_at)) AS customer_lifespan_days,
        GROUP_CONCAT(DISTINCT vt.label SEPARATOR ", ") AS preferred_types,
        GROUP_CONCAT(DISTINCT b.vehicle_number SEPARATOR ", ") AS all_vehicles
      FROM bills b
      LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
      WHERE b.customer_mobile IS NOT NULL AND TRIM(b.customer_mobile) != "" ${searchClause}
      GROUP BY b.customer_mobile
    `;

    let havingClause = '';
    if (status === 'Active') havingClause = 'HAVING days_since_last_visit <= 30';
    else if (status === 'At Risk') havingClause = 'HAVING days_since_last_visit > 30 AND days_since_last_visit <= 90';
    else if (status === 'Lost') havingClause = 'HAVING days_since_last_visit > 90';

    // Get accurate total using subquery
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${baseQuery} ${havingClause}) AS sub`,
      [...searchParam]
    );

    // Paginated results
    const [results] = await pool.query(
      `${baseQuery} ${havingClause} ORDER BY last_visit DESC LIMIT ? OFFSET ?`,
      [...searchParam, limit, offset]
    );

    res.json({ data: results, total, page, limit });
  } catch (err) {
    console.error('getCustomerAnalytics error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Summary KPIs for top stat cards
exports.getCustomerKPIs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        customer_mobile,
        COUNT(id) AS visit_count,
        SUM(total_amount) AS total_spent,
        DATEDIFF(NOW(), MAX(created_at)) AS days_since_last_visit
      FROM bills
      WHERE customer_mobile IS NOT NULL AND TRIM(customer_mobile) != ''
      GROUP BY customer_mobile
    `);

    const total_tracked = rows.length;
    const repeat_customers = rows.filter(r => r.visit_count > 1).length;
    const total_revenue = rows.reduce((sum, r) => sum + Number(r.total_spent), 0);
    const avg_visits = total_tracked > 0
      ? (rows.reduce((sum, r) => sum + Number(r.visit_count), 0) / total_tracked).toFixed(1)
      : 0;
    const active_customers = rows.filter(r => r.days_since_last_visit <= 30).length;
    const at_risk_customers = rows.filter(r => r.days_since_last_visit > 30 && r.days_since_last_visit <= 90).length;
    const lost_customers = rows.filter(r => r.days_since_last_visit > 90).length;

    res.json({ total_tracked, repeat_customers, total_revenue, avg_visits_per_customer: avg_visits, active_customers, at_risk_customers, lost_customers });
  } catch (err) {
    console.error('getCustomerKPIs error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Monthly visit trend (last 6 months)
exports.getVisitTrend = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%b %Y') AS month,
        DATE_FORMAT(created_at, '%Y-%m') AS month_key,
        COUNT(id) AS total_bills,
        COUNT(DISTINCT customer_mobile) AS unique_customers,
        SUM(total_amount) AS revenue
      FROM bills
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month_key, month
      ORDER BY month_key ASC
    `);
    res.json(results);
  } catch (err) {
    console.error('getVisitTrend error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Top customers by revenue
exports.getTopCustomers = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        customer_mobile,
        COUNT(id) AS visit_count,
        SUM(total_amount) AS total_spent,
        MAX(created_at) AS last_visit
      FROM bills
      WHERE customer_mobile IS NOT NULL AND TRIM(customer_mobile) != ''
      GROUP BY customer_mobile
      ORDER BY total_spent DESC
      LIMIT 10
    `);
    res.json(results);
  } catch (err) {
    console.error('getTopCustomers error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Visit frequency distribution
exports.getFrequencyDistribution = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT
        CASE
          WHEN visit_count = 1 THEN 'One-time'
          WHEN visit_count BETWEEN 2 AND 5 THEN '2 - 5 visits'
          WHEN visit_count BETWEEN 6 AND 10 THEN '6 - 10 visits'
          ELSE '10+ visits'
        END AS segment,
        COUNT(*) AS customers
      FROM (
        SELECT customer_mobile, COUNT(id) AS visit_count
        FROM bills
        WHERE customer_mobile IS NOT NULL AND TRIM(customer_mobile) != ''
        GROUP BY customer_mobile
      ) s
      GROUP BY segment
    `);
    res.json(results);
  } catch (err) {
    console.error('getFrequencyDistribution error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// Service popularity
exports.getServicePopularity = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        s.name,
        COUNT(b.id) AS usage_count,
        SUM(b.total_amount) AS revenue_generated
      FROM bills b
      JOIN services s ON b.service_id = s.id
      GROUP BY s.name
      ORDER BY usage_count DESC
    `);
    res.json(results);
  } catch (err) {
    console.error('getServicePopularity error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.getWorkshopKPIs = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const [rows] = await pool.query(`
      SELECT
        w.id,
        w.name,
        COUNT(b.id) AS bill_count,
        SUM(b.total_amount) AS total_spent,
        DATEDIFF(NOW(), MAX(b.created_at)) AS days_since_last_visit
      FROM workshops w
      JOIN bills b ON b.workshop_id = w.id
      GROUP BY w.id, w.name
    `);

    const total_workshops = rows.length;
    const repeat_workshops = rows.filter(row => Number(row.bill_count) > 1).length;
    const total_revenue = rows.reduce((sum, row) => sum + Number(row.total_spent || 0), 0);
    const active_workshops = rows.filter(row => Number(row.days_since_last_visit) <= 30).length;
    const at_risk_workshops = rows.filter(row => Number(row.days_since_last_visit) > 30 && Number(row.days_since_last_visit) <= 90).length;
    const lost_workshops = rows.filter(row => Number(row.days_since_last_visit) > 90).length;

    res.json({ total_workshops, repeat_workshops, total_revenue, active_workshops, at_risk_workshops, lost_workshops });
  } catch (err) {
    console.error('getWorkshopKPIs error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.getWorkshopAnalytics = async (req, res) => {
  try {
    await ensureWorkshopSchema();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || 'All';

    const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    const searchClause = search ? 'AND (w.name LIKE ? OR w.phone LIKE ? OR b.vehicle_number LIKE ?)' : '';

    const baseQuery = `
      SELECT
        w.id AS workshop_id,
        w.name AS workshop_name,
        w.contact_person,
        w.phone,
        COUNT(b.id) AS bill_count,
        COUNT(DISTINCT NULLIF(b.vehicle_number, '')) AS vehicle_count,
        SUM(b.total_amount) AS total_spent,
        AVG(b.total_amount) AS avg_spend,
        MIN(b.created_at) AS first_visit,
        MAX(b.created_at) AS last_visit,
        DATEDIFF(NOW(), MAX(b.created_at)) AS days_since_last_visit,
        GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') AS services_used
      FROM workshops w
      JOIN bills b ON b.workshop_id = w.id
      JOIN services s ON b.service_id = s.id
      WHERE 1=1 ${searchClause}
      GROUP BY w.id, w.name, w.contact_person, w.phone
    `;

    let havingClause = '';
    if (status === 'Active') havingClause = 'HAVING days_since_last_visit <= 30';
    else if (status === 'At Risk') havingClause = 'HAVING days_since_last_visit > 30 AND days_since_last_visit <= 90';
    else if (status === 'Lost') havingClause = 'HAVING days_since_last_visit > 90';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${baseQuery} ${havingClause}) AS sub`,
      searchParams
    );

    const [results] = await pool.query(
      `${baseQuery} ${havingClause} ORDER BY total_spent DESC, last_visit DESC LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );

    res.json({ data: results, total, page, limit });
  } catch (err) {
    console.error('getWorkshopAnalytics error:', err.message);
    res.status(500).json({ message: err.message });
  }
};
