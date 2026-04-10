const pool = require('../db');

// Get local date in YYYY-MM-DD using server timezone
function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset(); // minutes behind UTC
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
}

exports.getSummary = async (req, res) => {
  try {
    const today = localDate();

    const [[{ totalEmployees }]] = await pool.query('SELECT COUNT(*) as totalEmployees FROM users WHERE is_active = 1');
    const [[{ todayIncome }]]    = await pool.query('SELECT COALESCE(SUM(amount),0) as todayIncome FROM income WHERE date = ?', [today]);
    const [[{ todayExpenses }]]  = await pool.query('SELECT COALESCE(SUM(amount),0) as todayExpenses FROM expenses WHERE date = ?', [today]);
    const [[{ todayBills }]]     = await pool.query('SELECT COUNT(*) as todayBills FROM bills WHERE DATE(CONVERT_TZ(created_at, "+00:00", "+05:30")) = ?', [today]);
    const [[{ pendingWash }]]    = await pool.query("SELECT COUNT(*) as pendingWash FROM bills WHERE wash_status IN ('pending','in_progress')");
    const [[{ totalInHand }]]    = await pool.query("SELECT COALESCE(SUM(amount),0) as totalInHand FROM income WHERE type='in_hand' AND date=?", [today]);
    const [[{ totalAccount }]]   = await pool.query("SELECT COALESCE(SUM(amount),0) as totalAccount FROM income WHERE type='account' AND date=?", [today]);
    const [[{ monthlyIncome }]]  = await pool.query('SELECT COALESCE(SUM(amount),0) as monthlyIncome FROM income WHERE MONTH(date)=MONTH(CURDATE()) AND YEAR(date)=YEAR(CURDATE())');
    const [[{ monthlyExpenses }]]= await pool.query('SELECT COALESCE(SUM(amount),0) as monthlyExpenses FROM expenses WHERE MONTH(date)=MONTH(CURDATE()) AND YEAR(date)=YEAR(CURDATE())');

    const [weeklyIncome]   = await pool.query(`SELECT date, SUM(amount) as total FROM income WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY date ORDER BY date ASC`);
    const [weeklyExpenses] = await pool.query(`SELECT date, SUM(amount) as total FROM expenses WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY date ORDER BY date ASC`);
    const [vehicleStats]   = await pool.query(
      `SELECT vt.label, COUNT(*) as count FROM bills b
       JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
       WHERE DATE(CONVERT_TZ(b.created_at,'+00:00','+05:30')) = ? GROUP BY vt.label`, [today]
    );

    res.json({ totalEmployees, todayIncome, todayExpenses, todayBills, pendingWash, totalInHand, totalAccount, monthlyIncome, monthlyExpenses, weeklyIncome, weeklyExpenses, vehicleStats });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
