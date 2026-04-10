import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SkeletonRow, SkeletonCard } from '../components/Loaders';

export default function Income() {
  const [income, setIncome] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);

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
    setChartLoading(true);
    Promise.all([
      api.get(`/finance/income?startDate=${startDate}&endDate=${endDate}`),
      api.get('/finance/income/daily?days=30'),
    ]).then(([list, chart]) => {
      setIncome(list.data);
      setChartData(chart.data.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        'In Hand': Number(d.in_hand),
        'Account': Number(d.account),
      })));
    }).finally(() => { setLoading(false); setChartLoading(false); });
  }, [startDate, endDate]);

  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
  const inHand = income.filter(i => i.type === 'in_hand').reduce((s, i) => s + Number(i.amount), 0);
  const account = income.filter(i => i.type === 'account').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Income Tracking</h2><p>In-hand and account income overview</p></div>
      </div>

      {loading ? (
        <div className="stats-grid">{[0,1,2].map(i => <SkeletonCard key={i}/>)}</div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon amber"><span>₹</span></div><div className="stat-info"><h4>Total Income</h4><div className="stat-value amount-green">₹{totalIncome.toLocaleString()}</div></div></div>
          <div className="stat-card"><div className="stat-icon green"><span>💵</span></div><div className="stat-info"><h4>In Hand (Cash)</h4><div className="stat-value">₹{inHand.toLocaleString()}</div></div></div>
          <div className="stat-card"><div className="stat-icon blue"><span>🏦</span></div><div className="stat-info"><h4>Account (Online)</h4><div className="stat-value">₹{account.toLocaleString()}</div></div></div>
        </div>
      )}

      <div className="chart-container">
        <div className="chart-header">
          <h3>Daily Income (Last 30 Days)</h3>
          {chartLoading && <div className="dot-loader"><span/><span/><span/></div>}
        </div>
        {!chartLoading && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="inHandBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="accountBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(val) => `₹${val}`} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value, name) => [`₹${Number(value).toLocaleString()}`, name]}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
              />
              <Legend wrapperStyle={{ paddingTop: 10 }} />
              <Bar dataKey="In Hand" fill="url(#inHandBar)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Account" fill="url(#accountBar)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : !chartLoading && <div className="empty-state"><p>No income data yet</p></div>}
      </div>

      <div className="filter-bar">
        <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
        <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Amount</th><th>Type</th><th>Source</th><th>Date</th><th>Added By</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : income.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No income records</td></tr>
                : income.map((inc, i) => (
                    <tr key={inc.id}>
                      <td>{i + 1}</td>
                      <td><span className="amount amount-green">₹{Number(inc.amount).toLocaleString()}</span></td>
                      <td><span className={`badge ${inc.type === 'in_hand' ? 'badge-green' : 'badge-blue'}`}>{inc.type === 'in_hand' ? 'Cash' : 'Account'}</span></td>
                      <td>{inc.source}</td>
                      <td>{new Date(inc.date).toLocaleDateString('en-IN')}</td>
                      <td>{inc.created_by_name}</td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
