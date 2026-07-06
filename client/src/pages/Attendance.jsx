import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { SkeletonRow, Spinner } from '../components/Loaders';
import { useAuth } from '../context/AuthContext';
import { HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';
import toast from 'react-hot-toast';

const getISTDate = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5));
  return nd.toISOString().split('T')[0];
};

const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';

const formatDuration = (hoursValue) => {
  const totalMinutes = Math.round(Number(hoursValue || 0) * 60);
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [date, setDate] = useState(getISTDate());

  const load = async () => {
    setLoading(true);
    try {
      const attendanceReq = api.get(`/employees/attendance?startDate=${date}&endDate=${date}`);
      if (isAdmin) {
        const [attRes, empRes] = await Promise.all([attendanceReq, api.get('/employees')]);
        setRecords(attRes.data);
        setEmployees(empRes.data.filter(emp => emp.is_active && emp.role !== 'admin'));
      } else {
        const attRes = await attendanceReq;
        setRecords(attRes.data);
        setEmployees([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date, isAdmin]);

  const todayRecordsByEmployee = useMemo(() => {
    const map = {};
    for (const record of records) {
      if (!map[record.user_id]) map[record.user_id] = record;
      if (!record.clock_out) map[record.user_id] = record;
    }
    return map;
  }, [records]);

  const handleCheckIn = async (emp) => {
    setActionId(emp.id);
    try {
      await api.post('/employees/check-in', { user_id: emp.id });
      toast.success(`${emp.name} checked in`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check in');
    } finally {
      setActionId(null);
    }
  };

  const handleCheckOut = async (emp) => {
    setActionId(emp.id);
    try {
      const res = await api.post('/employees/check-out', { user_id: emp.id });
      toast.success(`${emp.name} checked out - ${formatDuration(res.data.hours)} worked`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check out');
    } finally {
      setActionId(null);
    }
  };

  const isToday = date === getISTDate();
  const activeNow = records.filter(record => !record.clock_out).length;
  const completedToday = records.filter(record => record.clock_out).length;

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h2>Attendance</h2>
          <p>{isAdmin ? 'Admin-managed employee check-in and check-out' : 'Your attendance records'}</p>
        </div>
      </div>

      <div className="filter-bar">
        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
        {loading
          ? <div className="dot-loader"><span/><span/><span/></div>
          : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{records.length} records found</span>
        }
      </div>

      {isAdmin && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon green"><HiOutlineLogin /></div><div className="stat-info"><h4>Clocked In</h4><div className="stat-value">{activeNow}</div></div></div>
            <div className="stat-card"><div className="stat-icon blue"><HiOutlineLogout /></div><div className="stat-info"><h4>Checked Out</h4><div className="stat-value">{completedToday}</div></div></div>
            <div className="stat-card"><div className="stat-icon amber"><span>E</span></div><div className="stat-info"><h4>Employees</h4><div className="stat-value">{employees.length}</div></div></div>
          </div>

          <h3 className="section-title">Employee Daily Status</h3>
          <div className="table-container" style={{ marginBottom: 24 }}>
            <table>
              <thead><tr><th>#</th><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : employees.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No active employees</td></tr>
                    : employees.map((emp, i) => {
                        const record = todayRecordsByEmployee[emp.id];
                        const isClockedIn = record && !record.clock_out;
                        return (
                          <tr key={emp.id}>
                            <td>{i + 1}</td>
                            <td><strong>{emp.name}</strong></td>
                            <td>{formatTime(record?.clock_in)}</td>
                            <td>{formatTime(record?.clock_out)}</td>
                            <td>{record?.total_hours ? formatDuration(record.total_hours) : '-'}</td>
                            <td><span className={`badge ${isClockedIn ? 'badge-amber' : record ? 'badge-green' : 'badge-blue'}`}>{isClockedIn ? 'Active' : record ? 'Completed' : 'Not In'}</span></td>
                            <td>
                              {isToday ? (
                                isClockedIn ? (
                                  <button className={`btn btn-secondary btn-sm ${actionId === emp.id ? 'loading' : ''}`} onClick={() => handleCheckOut(emp)} disabled={actionId === emp.id}>
                                    {actionId === emp.id ? <Spinner size={12} color="var(--text-primary)" /> : <><HiOutlineLogout /> Check Out</>}
                                  </button>
                                ) : !record ? (
                                  <button className={`btn btn-primary btn-sm ${actionId === emp.id ? 'loading' : ''}`} onClick={() => handleCheckIn(emp)} disabled={actionId === emp.id}>
                                    {actionId === emp.id ? <Spinner size={12} /> : <><HiOutlineLogin /> Check In</>}
                                  </button>
                                ) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Done</span>
                              ) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Past date</span>}
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="section-title">{isAdmin ? 'Attendance Records' : 'My Attendance Records'}</h3>
      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : records.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No attendance records</td></tr>
                : records.map((record, i) => (
                    <tr key={record.id}>
                      <td>{i + 1}</td>
                      <td><strong>{record.name}</strong></td>
                      <td>{formatTime(record.clock_in)}</td>
                      <td>{formatTime(record.clock_out)}</td>
                      <td>{record.total_hours ? formatDuration(record.total_hours) : '-'}</td>
                      <td><span className={`badge ${record.clock_out ? 'badge-green' : 'badge-amber'}`}>{record.clock_out ? 'Completed' : 'Active'}</span></td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
