import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { HiOutlineDownload, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { SkeletonRow, SkeletonCard, Spinner } from '../components/Loaders';
import { buildExportFilename, exportRowsToExcel } from '../utils/exportExcel';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

const CATEGORY_COLORS = {
  Water: '#3b82f6', Electricity: '#f59e0b', Supplies: '#10b981',
  Maintenance: '#8b5cf6', Rent: '#ec4899', Food: '#14b8a6',
  salary: '#f97316', Other: '#6b7280',
};
const ALL_COLORS = Object.values(CATEGORY_COLORS);
const DEFAULT_CATEGORIES = ['Water', 'Electricity', 'Supplies', 'Maintenance', 'Rent', 'Food', 'salary', 'Other'];

const getISTDate = (offsetDays = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(first), end: fmt(last) };
};

const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export default function Expenses() {
  const { danger } = useAlert();
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expenseCategories, setExpenseCategories] = useState(DEFAULT_CATEGORIES);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const { start: defaultStart, end: defaultEnd } = getMonthRange();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [form, setForm] = useState({ amount: '', category: '', description: '', date: getISTDate() });

  const fetchCategories = useCallback(() => {
    api.get('/finance/expense-categories')
      .then((res) => {
        const names = res.data.map((category) => category.name).filter(Boolean);
        setExpenseCategories([...new Set([...names, ...DEFAULT_CATEGORIES])]);
      })
      .catch(() => setExpenseCategories(DEFAULT_CATEGORIES));
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setChartLoading(true);
    const catParam = categoryFilter ? `&category=${categoryFilter}` : '';
    Promise.all([
      api.get(`/finance/expenses?startDate=${startDate}&endDate=${endDate}${catParam}`),
      api.get(`/finance/expenses/daily?startDate=${startDate}&endDate=${endDate}`),
    ]).then(([listRes, chartRes]) => {
      setExpenses(listRes.data);

      // Build daily grouped chart data
      const dayMap = {};
      const catSet = new Set();
      chartRes.data.forEach(d => {
        const key = new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (!dayMap[key]) dayMap[key] = { date: key };
        dayMap[key][d.category] = (dayMap[key][d.category] || 0) + Number(d.total);
        catSet.add(d.category);
      });
      setChartData(Object.values(dayMap));

      // Build category totals for pie/summary
      const catMap = {};
      chartRes.data.forEach(d => {
        catMap[d.category] = (catMap[d.category] || 0) + Number(d.total);
      });
      setCategoryTotals(Object.entries(catMap).map(([name, value]) => ({ name, value })));
    }).catch(() => toast.error('Failed to load expenses'))
      .finally(() => { setLoading(false); setChartLoading(false); });
  }, [startDate, endDate, categoryFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const setThisMonth = () => {
    const { start, end } = getMonthRange();
    setStartDate(start);
    setEndDate(end);
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setForm({ amount: '', category: '', description: '', date: getISTDate() });
  };

  const openAddExpense = () => {
    resetExpenseForm();
    setShowModal(true);
  };

  const openEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setForm({
      amount: String(expense.amount || ''),
      category: expense.category || '',
      description: expense.description || '',
      date: expense.date ? String(expense.date).slice(0, 10) : getISTDate(),
    });
    setShowModal(true);
  };

  const closeExpenseModal = () => {
    setShowModal(false);
    resetExpenseForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingExpenseId) {
        await api.put(`/finance/expenses/${editingExpenseId}`, form);
        toast.success('Expense updated');
      } else {
        await api.post('/finance/expenses', form);
        toast.success('Expense added');
      }
      closeExpenseModal();
      fetchData();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleExportExpenses = () => {
    exportRowsToExcel({
      filename: buildExportFilename('expenses', startDate, endDate),
      sheetName: 'Expenses',
      title: `Expense Records (${startDate} to ${endDate})`,
      columns: [
        { header: '#', value: (_row, index) => index + 1 },
        { header: 'Amount', value: row => Number(row.amount || 0), type: 'number' },
        { header: 'Category', value: row => row.category || '' },
        { header: 'Description', value: row => row.description || '' },
        { header: 'Date', value: row => row.date ? new Date(row.date).toLocaleDateString('en-IN') : '' },
        { header: 'Added By', value: row => row.created_by_name || '' },
      ],
      rows: expenses,
    });
    toast.success('Expenses Excel exported');
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return toast.error('Enter category name');
    setCategorySaving(true);
    try {
      await api.post('/finance/expense-categories', { name });
      toast.success('Expense category added');
      setCategoryName('');
      setShowCategoryModal(false);
      fetchCategories();
      setForm((current) => ({ ...current, category: name }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add category');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    const ok = await danger('Delete this expense record? This cannot be undone.', {
      title: 'Delete Expense',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const salaryTotal = expenses.filter(e => e.category === 'salary').reduce((s, e) => s + Number(e.amount), 0);
  const opexTotal = totalExpenses - salaryTotal;

  // Unique categories present in current data (for stacked bar legend)
  const presentCategories = [...new Set(chartData.flatMap(d => Object.keys(d).filter(k => k !== 'date')))];
  const manualCategories = expenseCategories.filter((category) => category.toLowerCase() !== 'salary');

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Expense Tracking</h2><p>Track and analyse all expenses by date range and category</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportExpenses} disabled={loading}><HiOutlineDownload /> Export Excel</button>
          {isAdmin && <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}><HiOutlinePlus /> Add Category</button>}
          <button className="btn btn-primary" onClick={openAddExpense}><HiOutlinePlus /> Add Expense</button>
        </div>
      </div>

      {/* ── DATE RANGE FILTER BAR ── */}
      <div className="filter-bar" style={{
        padding: '14px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-primary)', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
      }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Range:</label>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={startDate} max={endDate}
          onChange={e => setStartDate(e.target.value)} />
        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={endDate} min={startDate}
          onChange={e => setEndDate(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={setThisMonth}>This Month</button>
        <select className="form-control" style={{ width: 'auto' }} value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {expenseCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        {loading && <div className="dot-loader"><span /><span /><span /></div>}
      </div>

      {/* ── STAT CARDS ── */}
      {loading ? (
        <div className="stats-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon red"><span>₹</span></div>
            <div className="stat-info">
              <h4>Total Expenses</h4>
              <div className="stat-value amount-red">{formatCurrency(totalExpenses)}</div>
              <div className="stat-sub">{expenses.length} records</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><span>👥</span></div>
            <div className="stat-info">
              <h4>Salary Paid</h4>
              <div className="stat-value">{formatCurrency(salaryTotal)}</div>
              <div className="stat-sub">Employee salary payments</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><span>🔧</span></div>
            <div className="stat-info">
              <h4>Operational</h4>
              <div className="stat-value">{formatCurrency(opexTotal)}</div>
              <div className="stat-sub">Non-salary expenses</div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHARTS ROW ── */}
      <div className="grid-2">
        <div className="chart-container">
          <div className="chart-header"><h3>Daily Expense Trend</h3>{chartLoading && <div className="dot-loader"><span/><span/><span/></div>}</div>
          {!chartLoading && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }}
                  formatter={v => [formatCurrency(v)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {presentCategories.map(cat => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || '#6b7280'} radius={presentCategories.indexOf(cat) === presentCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : !chartLoading && <div className="empty-state"><p>No expense data for this range</p></div>}
        </div>

        <div className="chart-container">
          <div className="chart-header"><h3>By Category</h3></div>
          {categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryTotals} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={65} outerRadius={95} paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {categoryTotals.map((entry, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[entry.name] || ALL_COLORS[i % ALL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [formatCurrency(v)]}
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : !chartLoading && <div className="empty-state"><p>No data</p></div>}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="table-container">
        <table>
          <thead>
            <tr><th>#</th><th>Amount</th><th>Category</th><th>Description</th><th>Date</th><th>Added By</th>{isAdmin && <th></th>}</tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 7 : 6} />)
              : expenses.length === 0
                ? <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No expenses in this range</td></tr>
                : expenses.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td><span className="amount amount-red">₹{Number(e.amount).toLocaleString()}</span></td>
                    <td>
                      <span className="badge" style={{
                        background: `${CATEGORY_COLORS[e.category] || '#6b7280'}22`,
                        color: CATEGORY_COLORS[e.category] || '#6b7280',
                        border: `1px solid ${CATEGORY_COLORS[e.category] || '#6b7280'}44`
                      }}>
                        {e.category}
                      </span>
                    </td>
                    <td>{e.description || '—'}</td>
                    <td>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                    <td>{e.created_by_name}</td>
                    {isAdmin && (
                      <td>
                        {e.category === 'salary' ? (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Managed in Salary</span>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button className="btn-icon" title="Edit expense" onClick={() => openEditExpense(e)}><HiOutlinePencil size={16} /></button>
                            <button className="btn-icon" title="Delete expense" onClick={() => handleDeleteExpense(e.id)}><HiOutlineTrash size={16} /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* ── ADD MODAL ── */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <form className="modal" onSubmit={handleAddCategory} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense Category</h3>
              <button type="button" className="btn-icon" onClick={() => setShowCategoryModal(false)}>X</button>
            </div>
            <div className="form-group">
              <label>Category Name</label>
              <input
                type="text"
                className="form-control"
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                placeholder="Example: Diesel"
                maxLength={100}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${categorySaving ? 'loading' : ''}`} disabled={categorySaving}>
                {categorySaving ? 'Saving...' : 'Add Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeExpenseModal}>
          <div className="modal" onClick={ex => ex.stopPropagation()}>
            <div className="modal-header"><h3>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</h3><button className="btn-icon" onClick={closeExpenseModal}>X</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Amount (₹)</label><input type="number" className="form-control" value={form.amount} onChange={ev => setForm({...form, amount: ev.target.value})} required /></div>
                <div className="form-group"><label>Category</label>
                  <select className="form-control" value={form.category} onChange={ev => setForm({...form, category: ev.target.value})} required>
                    <option value="">Select</option>
                    {manualCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Description</label><input type="text" className="form-control" placeholder="Optional" value={form.description} onChange={ev => setForm({...form, description: ev.target.value})} /></div>
              <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.date} onChange={ev => setForm({...form, date: ev.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeExpenseModal}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                  {saving ? <><Spinner size={14}/> <span className="btn-text">Saving...</span></> : editingExpenseId ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
