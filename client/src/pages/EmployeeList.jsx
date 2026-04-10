import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useAlert } from '../context/AlertContext';
import toast, { Toaster } from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineUserGroup, HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';
import { SkeletonRow, SkeletonCard, Spinner } from '../components/Loaders';

export default function EmployeeList() {
  const { danger } = useAlert();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null); // which employee is being clocked
  const [form, setForm] = useState({ name: '', phone: '', password: '', role: 'employee', salary: '' });

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/employees'); setEmployees(r.data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/employees', form);
      toast.success('Employee added!');
      setShowModal(false);
      setForm({ name: '', phone: '', password: '', role: 'employee', salary: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleRemove = async (id, name) => {
    const ok = await danger(`Remove ${name} from the team?`, { title: 'Remove Employee', confirmText: 'Remove' });
    if (!ok) return;
    try { await api.delete(`/employees/${id}`); toast.success(`${name} removed`); load(); }
    catch { toast.error('Failed'); }
  };

  const handleCheckIn = async (emp) => {
    setActionId(emp.id);
    try {
      await api.post('/employees/check-in', { user_id: emp.id });
      toast.success(`${emp.name} checked in`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionId(null); }
  };

  const handleCheckOut = async (emp) => {
    setActionId(emp.id);
    try {
      const r = await api.post('/employees/check-out', { user_id: emp.id });
      toast.success(`${emp.name} checked out · ${r.data.hours}h worked`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionId(null); }
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const clockedIn   = employees.filter(e => e.is_active && e.att_id).length;

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Employee Management</h2><p>{loading ? '…' : `${activeCount} active · ${clockedIn} clocked in`}</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><HiOutlinePlus /> Add Employee</button>
      </div>

      {loading ? (
        <div className="stats-grid">{[0,1,2].map(i => <SkeletonCard key={i}/>)}</div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon green"><HiOutlineUserGroup /></div><div className="stat-info"><h4>Active</h4><div className="stat-value">{activeCount}</div></div></div>
          <div className="stat-card"><div className="stat-icon amber"><HiOutlineLogin /></div><div className="stat-info"><h4>Clocked In</h4><div className="stat-value">{clockedIn}</div></div></div>
          <div className="stat-card"><div className="stat-icon blue"><HiOutlineUserGroup /></div><div className="stat-info"><h4>Total</h4><div className="stat-value">{employees.length}</div></div></div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Phone</th><th>Role</th><th>Salary</th>
              <th>Status</th><th>Attendance</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              : employees.map((emp, i) => {
                  const isClockedIn = !!emp.att_id;
                  const clockInTime = emp.clock_in
                    ? new Date(emp.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  return (
                    <tr key={emp.id}>
                      <td>{i + 1}</td>
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.phone}</td>
                      <td><span className={`badge ${emp.role === 'admin' ? 'badge-amber' : 'badge-blue'}`}>{emp.role}</span></td>
                      <td>₹{Number(emp.salary).toLocaleString()}</td>
                      <td><span className={`badge ${emp.is_active ? 'badge-green' : 'badge-red'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        {emp.is_active
                          ? isClockedIn
                            ? <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>🟢 In since {clockInTime}</span>
                            : <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>⚪ Not clocked in</span>
                          : '—'
                        }
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {emp.is_active && (
                          isClockedIn ? (
                            <button
                              className={`btn btn-secondary btn-sm ${actionId === emp.id ? 'loading' : ''}`}
                              onClick={() => handleCheckOut(emp)}
                              disabled={actionId === emp.id}
                              title="Check Out"
                            >
                              {actionId === emp.id ? <Spinner size={12} color="var(--text-primary)" /> : <><HiOutlineLogout /> Out</>}
                            </button>
                          ) : (
                            <button
                              className={`btn btn-primary btn-sm ${actionId === emp.id ? 'loading' : ''}`}
                              onClick={() => handleCheckIn(emp)}
                              disabled={actionId === emp.id}
                              title="Check In"
                            >
                              {actionId === emp.id ? <Spinner size={12} /> : <><HiOutlineLogin /> In</>}
                            </button>
                          )
                        )}
                        {emp.is_active && user && emp.id !== user.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemove(emp.id, emp.name)}>
                            <HiOutlineTrash />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Employee</h3><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleAdd}>
              <div className="form-group"><label>Full Name</label><input type="text" className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Phone</label><input type="text" className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required /></div>
                <div className="form-group"><label>Password</label><input type="password" className="form-control" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="employee">Employee</option><option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group"><label>Monthly Salary</label><input type="number" className="form-control" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                  {saving ? <><Spinner size={14}/> <span className="btn-text">Adding...</span></> : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
