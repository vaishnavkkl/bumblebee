import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow, Spinner } from '../components/Loaders';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { useAlert } from '../context/AlertContext';

const getISTDate = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5));
  return nd.toISOString().split('T')[0];
};

const getCurrentMonth = () => getISTDate().slice(0, 7);
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const emptyForm = { user_id: '', amount: '', month: getCurrentMonth(), paid_date: getISTDate(), notes: '', type: 'salary' };

export default function Salary() {
  const { danger } = useAlert();
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({ employees: [], totals: { salary: 0, advance_paid: 0, salary_paid: 0, total_paid: 0, pending_salary: 0 } });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(getCurrentMonth());
  const [form, setForm] = useState(emptyForm);

  const summaryByEmployee = useMemo(() => {
    return Object.fromEntries(summary.employees.map(emp => [Number(emp.id), emp]));
  }, [summary.employees]);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, summaryRes, hist] = await Promise.all([
        api.get('/employees'),
        api.get(`/employees/salary-summary?month=${month}`),
        api.get(`/employees/salary-history?month=${month}`),
      ]);
      setEmployees(emps.data.filter(e => e.is_active));
      setSummary(summaryRes.data);
      setHistory(hist.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const openPayModal = (type, employeeId = '') => {
    const empSummary = employeeId ? summaryByEmployee[Number(employeeId)] : null;
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      type,
      month,
      user_id: employeeId ? String(employeeId) : '',
      amount: type === 'salary' && empSummary ? String(empSummary.pending_salary || '') : '',
      paid_date: getISTDate(),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPayment(null);
    setForm({ ...emptyForm, month });
  };

  const selectedSummary = form.user_id ? summaryByEmployee[Number(form.user_id)] : null;

  const handleEmployeeChange = (userId) => {
    const empSummary = summaryByEmployee[Number(userId)];
    setForm(prev => ({
      ...prev,
      user_id: userId,
      amount: prev.type === 'salary' && empSummary ? String(empSummary.pending_salary || '') : '',
    }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPayment) {
        await api.put(`/employees/salary-payments/${editingPayment.id}`, {
          amount: form.amount,
          paid_date: form.paid_date,
          notes: form.notes,
        });
        toast.success('Payment updated');
      } else {
        await api.post('/employees/salary-pay', form);
        toast.success(form.type === 'advance' ? 'Advance paid' : 'Salary paid');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const handleSalaryUpdate = async (id, salary) => {
    try {
      await api.put(`/employees/${id}/salary`, { salary });
      toast.success('Salary updated');
      load();
    } catch { toast.error('Failed'); }
  };

  const editPayment = (payment) => {
    setEditingPayment(payment);
    setForm({
      user_id: String(payment.user_id),
      amount: String(payment.amount),
      month: payment.month,
      paid_date: String(payment.paid_date).slice(0, 10),
      notes: payment.notes || '',
      type: payment.type || 'salary',
    });
    setShowModal(true);
  };

  const deletePayment = async (payment) => {
    const ok = await danger(`Delete this ${payment.type === 'advance' ? 'advance' : 'salary'} payment? The linked expense will also be removed.`, {
      title: 'Delete Salary Payment',
      confirmText: 'Delete',
    });
    if (!ok) return;

    try {
      await api.delete(`/employees/salary-payments/${payment.id}`);
      toast.success('Payment deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete payment');
    }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Salary Management</h2><p>Track advances, salary paid, and pending salary</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => openPayModal('advance')}><HiOutlinePlus /> Pay Advance</button>
          <button className="btn btn-primary" onClick={() => openPayModal('salary')}><HiOutlinePlus /> Pay Salary</button>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Month</label>
        <input type="month" className="form-control" value={month} onChange={e => setMonth(e.target.value)} />
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><span>S</span></div><div className="stat-info"><h4>Monthly Salary</h4><div className="stat-value">{formatMoney(summary.totals.salary)}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber"><span>A</span></div><div className="stat-info"><h4>Advance Paid</h4><div className="stat-value">{formatMoney(summary.totals.advance_paid)}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><span>P</span></div><div className="stat-info"><h4>Total Paid</h4><div className="stat-value amount-green">{formatMoney(summary.totals.total_paid)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><span>B</span></div><div className="stat-info"><h4>Pending Salary</h4><div className="stat-value amount-red">{formatMoney(summary.totals.pending_salary)}</div></div></div>
      </div>

      <h3 className="section-title">Employee Salary Overview</h3>
      <div className="table-container" style={{ marginBottom: 28 }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Role</th><th>Monthly Salary</th><th>Advance</th><th>Salary Paid</th><th>Pending</th><th>Update Salary</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              : summary.employees.map(emp => (
                  <tr key={emp.id}>
                    <td><strong>{emp.name}</strong></td>
                    <td><span className={`badge ${emp.role === 'admin' ? 'badge-amber' : 'badge-blue'}`}>{emp.role}</span></td>
                    <td>{formatMoney(emp.salary)}</td>
                    <td>{formatMoney(emp.advance_paid)}</td>
                    <td><span className="amount amount-green">{formatMoney(emp.salary_paid)}</span></td>
                    <td><span className={Number(emp.pending_salary) > 0 ? 'amount amount-red' : 'amount amount-green'}>{formatMoney(emp.pending_salary)}</span></td>
                    <td>
                      <input type="number" className="form-control" style={{ width: 120, display: 'inline-block' }}
                        defaultValue={emp.salary}
                        onBlur={e => { if (e.target.value !== String(emp.salary)) handleSalaryUpdate(emp.id, e.target.value); }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openPayModal('advance', emp.id)} disabled={Number(emp.pending_salary) <= 0}>Advance</button>
                        <button className="btn btn-primary btn-sm" onClick={() => openPayModal('salary', emp.id)} disabled={Number(emp.pending_salary) <= 0}>Pay</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      <h3 className="section-title">Payment History</h3>
      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Employee</th><th>Type</th><th>Amount</th><th>Month</th><th>Paid Date</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              : history.length === 0
                ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No salary payments</td></tr>
                : history.map((h, i) => (
                    <tr key={h.id}>
                      <td>{i + 1}</td>
                      <td><strong>{h.name}</strong></td>
                      <td><span className={`badge ${h.type === 'advance' ? 'badge-amber' : 'badge-green'}`}>{h.type === 'advance' ? 'Advance' : 'Salary'}</span></td>
                      <td><span className="amount">{formatMoney(h.amount)}</span></td>
                      <td>{h.month}</td>
                      <td>{new Date(h.paid_date).toLocaleDateString('en-IN')}</td>
                      <td>{h.notes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => editPayment(h)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deletePayment(h)}><HiOutlineTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPayment ? 'Edit Payment' : form.type === 'advance' ? 'Pay Advance' : 'Pay Salary'}</h3>
              <button className="btn-icon" onClick={closeModal}>x</button>
            </div>
            <form onSubmit={handlePay}>
              <div className="form-group"><label>Employee</label>
                <select className="form-control" value={form.user_id} onChange={e => handleEmployeeChange(e.target.value)} required disabled={!!editingPayment}>
                  <option value="">Select</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              {selectedSummary && (
                <div className="bill-summary" style={{ marginTop: 0, marginBottom: 16 }}>
                  <div className="bill-summary-row"><span>Monthly Salary</span><span>{formatMoney(selectedSummary.salary)}</span></div>
                  <div className="bill-summary-row"><span>Already Paid</span><span>{formatMoney(selectedSummary.total_paid)}</span></div>
                  <div className="bill-summary-row total"><span>Pending</span><span>{formatMoney(selectedSummary.pending_salary)}</span></div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>Amount</label><input type="number" min="1" className="form-control" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
                <div className="form-group"><label>Month</label><input type="month" className="form-control" value={form.month} onChange={e => setForm({...form, month: e.target.value})} required disabled={!!editingPayment} /></div>
              </div>
              <div className="form-group"><label>Payment Date</label><input type="date" className="form-control" value={form.paid_date} onChange={e => setForm({...form, paid_date: e.target.value})} /></div>
              <div className="form-group"><label>Notes</label><input type="text" className="form-control" placeholder="Optional" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                  {saving ? <><Spinner size={14} /> <span className="btn-text">Processing...</span></> : editingPayment ? 'Save Changes' : form.type === 'advance' ? 'Pay Advance' : 'Pay Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
