import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SkeletonRow } from '../components/Loaders';

const formatDuration = (hoursValue) => {
  const totalMinutes = Math.round(Number(hoursValue || 0) * 60);
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};

export default function WorkingHours() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const getISTDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    return nd.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getISTDate(-30));
  const [endDate, setEndDate] = useState(getISTDate(0));

  const setThisWeek = () => {
    const now = new Date();
    const day = now.getDay() || 7;
    setStartDate(getISTDate(-(day - 1)));
    setEndDate(getISTDate(0));
  };

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setStartDate(fmt(start));
    setEndDate(getISTDate(0));
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/employees/working-hours?startDate=${startDate}&endDate=${endDate}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const chartData = data.map(d => ({ name: d.name, hours: Number(d.total_hours), days: Number(d.days_present) }));
  const totalHours = data.reduce((sum, item) => sum + Number(item.total_hours || 0), 0);
  const totalDays = data.reduce((sum, item) => sum + Number(item.days_present || 0), 0);
  const presentEmployees = data.filter(item => Number(item.days_present || 0) > 0).length;
  const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Working Hours</h2><p>Employee working hours summary</p></div>
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
      </div>

      <div className="filter-bar">
        <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
        <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={setThisWeek}>This Week</button>
        <button className="btn btn-secondary btn-sm" onClick={setThisMonth}>This Month</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon amber"><span>H</span></div><div className="stat-info"><h4>Total Hours</h4><div className="stat-value">{formatDuration(totalHours)}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><span>D</span></div><div className="stat-info"><h4>Days Present</h4><div className="stat-value">{totalDays}</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><span>E</span></div><div className="stat-info"><h4>Employees Present</h4><div className="stat-value">{presentEmployees}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><span>A</span></div><div className="stat-info"><h4>Avg Hours / Day</h4><div className="stat-value">{formatDuration(avgHoursPerDay)}</div></div></div>
      </div>

      <div className="chart-container">
        <div className="chart-header"><h3>Hours Worked per Employee</h3></div>
        {loading ? (
          <div style={{ padding: '40px 20px' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 28, marginBottom: 12, borderRadius: 6, width: `${60 + i * 15}%` }} />)}
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis type="number" tickFormatter={formatDuration} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip formatter={(value) => [formatDuration(value), 'Hours']} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="hours" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="empty-state"><p>No data for this period</p></div>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Employee</th><th>Total Hours</th><th>Days Present</th><th>Avg Hours/Day</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              : data.map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>{formatDuration(d.total_hours)}</td>
                    <td>{d.days_present}</td>
                    <td>{formatDuration(d.days_present > 0 ? Number(d.total_hours) / d.days_present : 0)}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
