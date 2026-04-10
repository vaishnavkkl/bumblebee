import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { BikeIcon, CarIcon, TruckIcon } from '../components/VehicleIcons';
import { Spinner } from '../components/Loaders';

const statusColors = { in_progress: 'badge-blue', completed: 'badge-green' };
const statusLabels = { in_progress: 'In Progress', completed: 'Completed' };
const nextStatus = { in_progress: 'completed' };
const vtMiniIcon = { Bike: BikeIcon, Car: CarIcon, 'Heavy Vehicle': TruckIcon };

export default function VehicleStatus() {
  const { confirm } = useAlert();
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`;
      const r = await api.get(`/billing${params}`);
      setBills(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status, label) => {
    const ok = await confirm(`Mark this vehicle as "${label}"?`, { title: 'Update Status', confirmText: 'Update', variant: 'info', icon: '🚿' });
    if (!ok) return;
    setUpdatingId(id);
    try {
      await api.put(`/billing/${id}/status`, { status });
      toast.success(`Status updated to ${label}`);
      load();
    } catch { toast.error('Failed'); }
    finally { setUpdatingId(null); }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Wash Status Board</h2><p>Track wash progress for all vehicles</p></div>
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
      </div>

      <div className="tabs">
        {['all', 'in_progress', 'completed'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="wash-board">
          {[0,1,2,3].map(i => (
            <div key={i} className="wash-card">
              <div className="skeleton" style={{ height: 28, marginBottom: 14, borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 36, marginTop: 12, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🚿</div><h3>No vehicles</h3><p>No vehicles match the current filter</p></div>
      ) : (
        <div className="wash-board">
          {bills.map(b => {
             // Calculate duration if completed
             let durationStr = null;
             if (b.wash_status === 'completed' && b.wash_completed_at) {
               const start = new Date(b.created_at).getTime();
               const end = new Date(b.wash_completed_at).getTime();
               const diffMins = Math.floor((end - start) / 60000);
               const hrs = Math.floor(diffMins / 60);
               const mins = diffMins % 60;
               if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
               else if (mins > 0) durationStr = `${mins}m`;
               else durationStr = '<1m';
             }
             
             return (
              <div key={b.id} className="wash-card">
                <div className="wash-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ transform: 'scale(0.45)', transformOrigin: 'left center', width: 50, height: 30, overflow: 'hidden', flexShrink: 0 }}>
                      {vtMiniIcon[b.vehicle_type] ? (() => { const C = vtMiniIcon[b.vehicle_type]; return <C selected={b.wash_status === 'in_progress'} mini={true} />; })() : null}
                    </div>
                    <strong>{b.vehicle_number || 'No plate'}</strong>
                  </div>
                  <span className={`badge ${statusColors[b.wash_status]}`}>{statusLabels[b.wash_status]}</span>
                </div>
                <div className="wash-card-body">
                  <p><strong>{b.vehicle_type}</strong> · {b.service_name}</p>
                  <p>Amount: ₹{Number(b.total_amount).toLocaleString()}</p>
                  <p>By: {b.created_by_name}</p>
                  {user?.role === 'admin' && durationStr && <p style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>Wash Time: {durationStr}</p>}
                  {b.extras?.length > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Extras: {b.extras.map(e => e.name).join(', ')}</p>}
                </div>
                {nextStatus[b.wash_status] && (
                  <button
                    className={`btn btn-primary btn-sm wash-status-btn ${updatingId === b.id ? 'loading' : ''}`}
                    onClick={() => updateStatus(b.id, nextStatus[b.wash_status], statusLabels[nextStatus[b.wash_status]])}
                    disabled={updatingId === b.id}
                  >
                    {updatingId === b.id
                      ? <><Spinner size={12} /> Updating...</>
                      : `Mark as ${statusLabels[nextStatus[b.wash_status]]}`
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
