import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HiOutlinePlus } from 'react-icons/hi';
import { SkeletonRow, Spinner } from '../components/Loaders';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const getISTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    return nd.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({ amount: '', category: '', description: '', date: getISTDate() });

  const load = async () => {
    setLoading(true);
    setChartLoading(true);
    try {
      const [list, chart] = await Promise.all([
        api.get('/finance/expenses'),
        api.get('/finance/expenses/daily?days=30'),
      ]);
      setExpenses(list.data);
      const grouped = {};
      chart.data.forEach(d => {
        const key = new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        grouped[key] = (grouped[key] || 0) + Number(d.total);
      });
      setChartData(Object.entries(grouped).map(([date, total]) => ({ date, total })));
    } finally { setLoading(false); setChartLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/expenses', form);
      toast.success('Expense added');
      setShowModal(false);
      setForm({ amount: '', category: '', description: '', date: getISTDate() });
      load();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const todayTotal = expenses.filter(e => e.date?.startsWith(getISTDate())).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Daily Expenses</h2><p>Track and manage expenses</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><HiOutlinePlus /> Add Expense</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red"><span>₹</span></div>
          <div className="stat-info"><h4>Today's Expenses</h4><div className="stat-value amount-red">{loading ? '—' : `₹${todayTotal.toLocaleString()}`}</div></div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-header"><h3>Daily Expense Trend (Last 30 Days)</h3>{chartLoading && <div className="dot-loader"><span/><span/><span/></div>}</div>
        {!chartLoading && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="expBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(val) => `₹${val}`} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Expenses']}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                cursor={{ fill: 'rgba(239, 68, 68, 0.05)' }}
              />
              <Bar dataKey="total" name="Expenses" fill="url(#expBar)" radius={[4, 4, 0, 0]} barSize={32}>
                {chartData.map((e, index) => (
                  <Cell key={`cell-${index}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : !chartLoading && <div className="empty-state"><p>No expense data</p></div>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Amount</th><th>Category</th><th>Description</th><th>Date</th><th>Added By</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : expenses.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No expenses recorded</td></tr>
                : expenses.map((e, i) => (
                    <tr key={e.id}>
                      <td>{i + 1}</td>
                      <td><span className="amount amount-red">₹{Number(e.amount).toLocaleString()}</span></td>
                      <td><span className="badge badge-red">{e.category}</span></td>
                      <td>{e.description || '—'}</td>
                      <td>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                      <td>{e.created_by_name}</td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={ex => ex.stopPropagation()}>
            <div className="modal-header"><h3>Add Expense</h3><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Amount</label><input type="number" className="form-control" value={form.amount} onChange={ev => setForm({...form, amount: ev.target.value})} required /></div>
                <div className="form-group"><label>Category</label>
                  <select className="form-control" value={form.category} onChange={ev => setForm({...form, category: ev.target.value})} required>
                    <option value="">Select</option>
                    <option value="Water">Water</option><option value="Electricity">Electricity</option>
                    <option value="Supplies">Supplies</option><option value="Maintenance">Maintenance</option>
                    <option value="Rent">Rent</option><option value="Food">Food</option><option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Description</label><input type="text" className="form-control" placeholder="Optional" value={form.description} onChange={ev => setForm({...form, description: ev.target.value})} /></div>
              <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.date} onChange={ev => setForm({...form, date: ev.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                  {saving ? <><Spinner size={14}/> <span className="btn-text">Saving...</span></> : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
