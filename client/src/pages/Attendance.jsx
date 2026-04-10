import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { SkeletonRow, Spinner } from '../components/Loaders';
import { useAuth } from '../context/AuthContext';
import { HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Attendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const getISTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    return nd.toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getISTDate());

  const load = () => {
    setLoading(true);
    api.get(`/employees/attendance?startDate=${date}&endDate=${date}`)
      .then(r => setRecords(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [date]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/employees/check-in', { user_id: user.id });
      toast.success('You have checked in for the day!');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to check in'); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const r = await api.post('/employees/check-out', { user_id: user.id });
      toast.success(`Checked out! Total hours: ${r.data.hours}`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to check out'); }
    finally { setActionLoading(false); }
  };

  const isToday = date === getISTDate();
  const myTodayRecord = records.find(r => r.user_id === user?.id);
  const amICheckedIn = myTodayRecord && !myTodayRecord.clock_out;

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div><h2>Attendance</h2><p>Employee clock-in and clock-out records</p></div>
      </div>

      {isToday && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', padding: '16px 20px', borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>My Status Today</h4>
            <p style={{ margin: '4px 0 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              {amICheckedIn ? 'You are currently clocked in.' : myTodayRecord ? 'You have checked out for today.' : 'You have not checked in yet.'}
            </p>
          </div>
          <div>
            {!myTodayRecord && (
              <button className={`btn btn-primary ${actionLoading ? 'loading' : ''}`} onClick={handleCheckIn} disabled={actionLoading}>
                {actionLoading ? <Spinner size={14} /> : <><HiOutlineLogin /> Check In</>}
              </button>
            )}
            {amICheckedIn && (
              <button className={`btn btn-secondary ${actionLoading ? 'loading' : ''}`} onClick={handleCheckOut} disabled={actionLoading}>
                {actionLoading ? <Spinner size={14} color="var(--text-primary)" /> : <><HiOutlineLogout /> Check Out</>}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="filter-bar">
        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
        {loading
          ? <div className="dot-loader"><span/><span/><span/></div>
          : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{records.length} records found</span>
        }
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : records.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No attendance records</td></tr>
                : records.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td><strong>{r.name}</strong></td>
                      <td>{new Date(r.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>{r.total_hours ? `${Number(r.total_hours).toFixed(1)}h` : '—'}</td>
                      <td><span className={`badge ${r.clock_out ? 'badge-green' : 'badge-amber'}`}>{r.clock_out ? 'Completed' : 'Active'}</span></td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
