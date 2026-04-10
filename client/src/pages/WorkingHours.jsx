import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SkeletonRow } from '../components/Loaders';

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

  useEffect(() => {
    setLoading(true);
    api.get(`/employees/working-hours?startDate=${startDate}&endDate=${endDate}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const chartData = data.map(d => ({ name: d.name, hours: Number(d.total_hours), days: Number(d.days_present) }));

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
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13 }} />
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
                    <td>{Number(d.total_hours).toFixed(1)}h</td>
                    <td>{d.days_present}</td>
                    <td>{d.days_present > 0 ? (Number(d.total_hours) / d.days_present).toFixed(1) : '0'}h</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
