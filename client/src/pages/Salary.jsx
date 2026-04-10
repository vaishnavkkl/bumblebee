import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow, Spinner } from '../components/Loaders';
import { HiOutlinePlus } from 'react-icons/hi';

export default function Salary() {
  const [employees, setEmployees] = useState([]);
  const [history, setHistory] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const getISTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    return nd.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({ user_id: '', amount: '', month: '', paid_date: getISTDate(), notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [emps, hist] = await Promise.all([
        api.get('/employees'),
        api.get('/employees/salary-history'),
      ]);
      setEmployees(emps.data.filter(e => e.is_active));
      setHistory(hist.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handlePay = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/employees/salary-pay', form);
      toast.success('Salary paid successfully!');
      setShowModal(false);
      setForm({ user_id: '', amount: '', month: '', paid_date: getISTDate(), notes: '' });
      load();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleSalaryUpdate = async (id, salary) => {
    try {
      await api.put(`/employees/${id}/salary`, { salary });
      toast.success('Salary updated');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Salary Management</h2><p>Set salaries and track payments</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><HiOutlinePlus /> Pay Salary</button>
      </div>

      <h3 className="section-title">Employee Salaries</h3>
      <div className="table-container" style={{ marginBottom: 28 }}>
        <table>
          <thead><tr><th>Employee</th><th>Role</th><th>Monthly Salary</th><th>Update</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
              : employees.map(emp => (
                  <tr key={emp.id}>
                    <td><strong>{emp.name}</strong></td>
                    <td><span className={`badge ${emp.role === 'admin' ? 'badge-amber' : 'badge-blue'}`}>{emp.role}</span></td>
                    <td>₹{Number(emp.salary).toLocaleString()}</td>
                    <td>
                      <input type="number" className="form-control" style={{ width: 120, display: 'inline-block' }}
                        defaultValue={emp.salary}
                        onBlur={e => { if (e.target.value !== String(emp.salary)) handleSalaryUpdate(emp.id, e.target.value); }}
                      />
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
          <thead><tr><th>#</th><th>Employee</th><th>Amount</th><th>Month</th><th>Paid Date</th><th>Notes</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : history.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No salary payments</td></tr>
                : history.map((h, i) => (
                    <tr key={h.id}>
                      <td>{i + 1}</td>
                      <td><strong>{h.name}</strong></td>
                      <td><span className="amount">₹{Number(h.amount).toLocaleString()}</span></td>
                      <td>{h.month}</td>
                      <td>{new Date(h.paid_date).toLocaleDateString('en-IN')}</td>
                      <td>{h.notes || '—'}</td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Pay Salary</h3><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handlePay}>
              <div className="form-group"><label>Employee</label>
                <select className="form-control" value={form.user_id} onChange={e => {
                  const emp = employees.find(x => x.id === Number(e.target.value));
                  setForm({...form, user_id: e.target.value, amount: emp?.salary || '' });
                }} required>
                  <option value="">Select</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Amount</label><input type="number" className="form-control" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
                <div className="form-group"><label>Month</label><input type="month" className="form-control" value={form.month} onChange={e => setForm({...form, month: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label>Payment Date</label><input type="date" className="form-control" value={form.paid_date} onChange={e => setForm({...form, paid_date: e.target.value})} /></div>
              <div className="form-group"><label>Notes</label><input type="text" className="form-control" placeholder="Optional" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                  {saving ? <><Spinner size={14} /> <span className="btn-text">Processing...</span></> : 'Pay Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
