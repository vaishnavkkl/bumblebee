import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { SkeletonRow, SkeletonCard, Spinner } from '../components/Loaders';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineExclamation, HiOutlineDatabase, HiOutlineCloudUpload } from 'react-icons/hi';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
const SOURCE_OPTIONS = ['wash', 'advance', 'balance_payment', 'other'];

const getISTDate = (offsetDays = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(first), end: fmt(last) };
};

const formatCurrency = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>{(payload[0].name || '').replace(/_/g, ' ')}</div>
        <div style={{ color: payload[0].fill }}>{formatCurrency(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

export default function Income() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'report' | 'maintenance'
  const [startDate, setStartDate] = useState(getMonthRange().start);
  const [endDate, setEndDate] = useState(getMonthRange().end);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'in_hand' | 'account' | 'pending'

  // Records state
  const [income, setIncome] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);

  // Report state
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(false);

  // Maintenance state
  const [resetPhrase, setResetPhrase] = useState('');
  const [isReseting, setIsReseting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', type: 'in_hand', source: 'wash', description: '', date: getISTDate() });

  const fetchRecords = useCallback(() => {
    setLoading(true);
    setChartLoading(true);
    const typeParam = filterType !== 'all' ? `&type=${filterType}` : '';
    Promise.all([
      api.get(`/finance/income?startDate=${startDate}&endDate=${endDate}${typeParam}`),
      api.get(`/finance/income/daily?startDate=${startDate}&endDate=${endDate}`),
    ]).then(([listRes, chartRes]) => {
      setIncome(listRes.data);
      setChartData(chartRes.data.map((d) => ({
        date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        'In Hand': Number(d.in_hand),
        Account: Number(d.account),
        Pending: Number(d.pending || 0),
      })));
    }).catch(() => toast.error('Failed to load records')).finally(() => { setLoading(false); setChartLoading(false); });
  }, [startDate, endDate, filterType]);

  const fetchReport = useCallback(() => {
    setReportLoading(true);
    setReportError(false);
    api.get(`/finance/report?startDate=${startDate}&endDate=${endDate}`)
      .then((res) => setReportData(res.data))
      .catch(() => { setReportError(true); toast.error('Failed to load report'); })
      .finally(() => setReportLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'list') fetchRecords();
    else if (activeTab === 'report') fetchReport();
  }, [activeTab, startDate, endDate, fetchRecords, fetchReport]);

  const inHand = income.filter((i) => i.type === 'in_hand').reduce((s, i) => s + Number(i.amount), 0);
  const inAccount = income.filter((i) => i.type === 'account').reduce((s, i) => s + Number(i.amount), 0);
  const pending = income.filter((i) => i.type === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalIncome = inHand + inAccount;

  const handleAddIncome = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await api.post('/finance/income', form);
      toast.success('Income added');
      setShowModal(false);
      setForm({ amount: '', type: 'in_hand', source: 'wash', description: '', date: getISTDate() });
      fetchRecords();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleDeleteIncome = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await api.delete(`/finance/income/${id}`); toast.success('Deleted'); setIncome(p => p.filter(i => i.id !== id)); } catch { toast.error('Failed'); }
  };

  const setThisMonth = () => { const { start, end } = getMonthRange(); setStartDate(start); setEndDate(end); };

  // Maintenance Handlers
  const handleBulkDelete = async (type) => {
    const confirm = window.confirm(`Are you absolutely sure you want to delete ${type} data between ${startDate} and ${endDate}? This cannot be undone!`);
    if (!confirm) return;
    try {
      await api.post('/finance/bulk-delete', { startDate, endDate, type });
      toast.success('Data deleted successfully');
      if (activeTab === 'list') fetchRecords(); else fetchReport();
    } catch (err) { toast.error('Failed to delete data'); }
  };

  const handleResetSystem = async () => {
    if (resetPhrase !== 'RESET ALL DATA') return toast.error('Type the correct phrase to reset');
    setIsReseting(true);
    try {
      await api.post('/finance/reset-system', { confirmPhrase: resetPhrase });
      toast.success('System has been fully reset');
      setResetPhrase('');
      window.location.reload();
    } catch { toast.error('Reset failed'); } finally { setIsReseting(false); }
  };

  const handleBackup = () => {
    toast.loading('Generating backup...', { id: 'bk' });
    // In a real app, this would call a GDrive integration.
    // For now, we'll offer a local JSON download as an immediate backup.
    const data = { income, reportData, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bumblebee_backup_${getISTDate()}.json`;
    a.click();
    toast.success('Backup downloaded locally!', { id: 'bk' });
    toast('Google Drive integration requires API keys configured in settings.', { icon: 'ℹ️' });
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Income Module</h2>
          <p>Track, manage and analyse all income streams</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('list')}>📋 Records</button>
          <button className={`btn btn-sm ${activeTab === 'report' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('report')}>📊 Report</button>
          <button className={`btn btn-sm ${activeTab === 'maintenance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('maintenance')}>⚙️ Maintenance</button>
          {activeTab === 'list' && <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><HiOutlinePlus /> Add Income</button>}
        </div>
      </div>

      <div className="filter-bar" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Range:</label>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={setThisMonth}>This Month</button>
        {(loading || reportLoading) && <div className="dot-loader"><span /><span /><span /></div>}
      </div>

      {activeTab === 'list' && (
        <>
          {loading ? <div className="stats-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : (
            <div className="stats-grid">
              <div className={`stat-card clickable ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
                <div className="stat-icon amber"><span>₹</span></div>
                <div className="stat-info"><h4>Realized Income</h4><div className="stat-value amount-green">{formatCurrency(totalIncome)}</div><div className="stat-sub">{income.filter(i => i.type !== 'pending').length} records</div></div>
              </div>
              <div className={`stat-card clickable ${filterType === 'in_hand' ? 'active' : ''}`} onClick={() => setFilterType('in_hand')}>
                <div className="stat-icon green"><span>💵</span></div>
                <div className="stat-info"><h4>In Hand</h4><div className="stat-value">{formatCurrency(inHand)}</div></div>
              </div>
              <div className={`stat-card clickable ${filterType === 'account' ? 'active' : ''}`} onClick={() => setFilterType('account')}>
                <div className="stat-icon blue"><span>🏦</span></div>
                <div className="stat-info"><h4>In Account</h4><div className="stat-value">{formatCurrency(inAccount)}</div></div>
              </div>
              <div className={`stat-card clickable ${filterType === 'pending' ? 'active' : ''}`} onClick={() => setFilterType('pending')}>
                <div className="stat-icon red"><span>⏳</span></div>
                <div className="stat-info"><h4>Pending</h4><div className="stat-value amount-red">{formatCurrency(pending)}</div><div className="stat-sub">{income.filter(i => i.type === 'pending').length} bills</div></div>
              </div>
            </div>
          )}
          <div className="chart-container">
            <div className="chart-header"><h3>Daily Income Trend</h3></div>
            {!chartLoading && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatCurrency(v)]} />
                  <Legend />
                  <Bar dataKey="In Hand" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Account" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No chart data</div>}
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Amount</th><th>Type</th><th>Source</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {income.map((inc, i) => (
                  <tr key={inc.id}>
                    <td>{i + 1}</td>
                    <td><span className="amount amount-green">{formatCurrency(inc.amount)}</span></td>
                    <td><span className={`badge ${inc.type === 'in_hand' ? 'badge-green' : inc.type === 'account' ? 'badge-blue' : 'badge-amber'}`}>{inc.type === 'in_hand' ? 'Cash' : inc.type === 'account' ? 'Account' : 'Pending'}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{(inc.source || '').replace(/_/g, ' ')} {inc.type === 'pending' ? <small style={{display:'block',color:'var(--text-tertiary)'}}>{inc.description}</small> : ''}</td>
                    <td>{new Date(inc.date).toLocaleDateString('en-IN')}</td>
                    <td>{inc.type !== 'pending' && <button className="btn-icon" onClick={() => handleDeleteIncome(inc.real_id || inc.id)}><HiOutlineTrash size={16} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'report' && (
        <div className="fade-in">
          {reportData ? (
            <>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-info"><h4>Total Income</h4><div className="stat-value amount-green">{formatCurrency(reportData.summary.totalIncome)}</div></div></div>
                <div className="stat-card"><div className="stat-info"><h4>Total Expense</h4><div className="stat-value amount-red">{formatCurrency(reportData.summary.totalExpense)}</div></div></div>
                <div className="stat-card"><div className="stat-info"><h4>Net Profit</h4><div className={`stat-value ${reportData.summary.netBalance >= 0 ? 'amount-green' : 'amount-red'}`}>{formatCurrency(reportData.summary.netBalance)}</div></div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
                <div className="chart-container">
                  <div className="chart-header"><h3>Income Sources</h3></div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={reportData.incomeBySource} dataKey="total" nameKey="source" innerRadius={60} outerRadius={80} paddingAngle={5}>{reportData.incomeBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend formatter={(v) => (v || '').replace(/_/g, ' ')} /></PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-container">
                  <div className="chart-header"><h3>Expense Categories</h3></div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={reportData.expenseByCategory} dataKey="total" nameKey="category" innerRadius={60} outerRadius={80} paddingAngle={5}>{reportData.expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[(i+2) % COLORS.length]} />)}</Pie><Tooltip content={<PieTooltip />} /><Legend formatter={(v) => (v || '').replace(/_/g, ' ')} /></PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : <div className="empty-state">No report data</div>}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Section 1: Range Deletion */}
          <div className="chart-container" style={{ borderTop: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <HiOutlineTrash size={24} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0 }}>Partial Deletion</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Delete records only for the selected date range (<strong>{startDate}</strong> to <strong>{endDate}</strong>).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleBulkDelete('income')}>
                Delete Income for this range
              </button>
              <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleBulkDelete('expenses')}>
                Delete Expenses for this range
              </button>
            </div>
          </div>

          {/* Section 2: Backup */}
          <div className="chart-container" style={{ borderTop: '4px solid var(--info)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <HiOutlineCloudUpload size={24} style={{ color: 'var(--info)' }} />
              <h3 style={{ margin: 0 }}>Data Backup</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Download a complete snapshot of your data. To enable auto-backup to Google Drive, please contact support for API configuration.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleBackup}>
              <HiOutlineDatabase /> Download Backup Now
            </button>
          </div>

          {/* Section 3: Full Reset */}
          <div className="chart-container" style={{ borderTop: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <HiOutlineExclamation size={24} style={{ color: 'var(--danger)' }} />
              <h3 style={{ margin: 0 }}>Factory Reset</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              This will wipe <strong>ALL</strong> data (Income, Expenses, Bills, Employees, Attendance). Only your Admin account will remain.
            </p>
            <div className="form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)' }}>TYPE: RESET ALL DATA</label>
              <input type="text" className="form-control" placeholder="Type phrase to confirm" value={resetPhrase} onChange={(e) => setResetPhrase(e.target.value)} style={{ borderColor: resetPhrase === 'RESET ALL DATA' ? 'var(--danger)' : 'var(--border-primary)' }} />
            </div>
            <button className={`btn btn-primary ${isReseting ? 'loading' : ''}`} style={{ width: '100%', background: 'var(--danger)', marginTop: 10 }} disabled={resetPhrase !== 'RESET ALL DATA' || isReseting} onClick={handleResetSystem}>
              {isReseting ? 'Reseting...' : 'PERFORM FULL RESET'}
            </button>
          </div>
        </div>
      )}

      {/* Modal ... (same as before) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Income</h3></div>
            <form onSubmit={handleAddIncome}>
              <div className="form-row">
                <div className="form-group"><label>Amount (₹)</label><input type="number" className="form-control" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="in_hand">Cash</option><option value="account">Account</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Source</label>
                  <select className="form-control" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Income</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
