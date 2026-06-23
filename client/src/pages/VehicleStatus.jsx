import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { BikeIcon, CarIcon, TruckIcon } from '../components/VehicleIcons';
import { Spinner } from '../components/Loaders';
import Pagination from '../components/Pagination';
import { printBill } from '../utils/printBill';

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [completionBill, setCompletionBill] = useState(null);
  const [completionPayment, setCompletionPayment] = useState({ payment_status: 'paid', payment_mode: 'cash', discount_amount: '' });

  const load = async () => {
    setLoading(true);
    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const r = await api.get(`/billing?page=${page}&limit=${limit}${statusParam}`);
      setBills(r.data.data);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter, page, limit]);

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

  const openCompletionModal = (bill) => {
    setCompletionBill(bill);
    setCompletionPayment({ payment_status: 'paid', payment_mode: 'cash', discount_amount: bill.discount_amount > 0 ? String(bill.discount_amount) : '' });
  };

  const closeCompletionModal = () => {
    setCompletionBill(null);
    setCompletionPayment({ payment_status: 'paid', payment_mode: 'cash', discount_amount: '' });
  };

  const completeWash = async (e) => {
    e.preventDefault();
    if (!completionBill) return;
    const subtotal = Number(completionBill.total_amount || 0) + Number(completionBill.discount_amount || 0);
    const discount = Number(completionPayment.discount_amount) || 0;
    if (discount > subtotal) {
      toast.error('Discount cannot be more than the service total');
      return;
    }
    setUpdatingId(completionBill.id);
    try {
      const completedBill = {
        ...completionBill,
        subtotal: completionSubtotal,
        discount_amount: discount,
        total_amount: completionAmountDue,
        payment_status: completionPayment.payment_status,
        payment_mode: completionPayment.payment_mode,
        wash_status: 'completed',
        wash_completed_at: new Date().toISOString(),
      };
      await api.put(`/billing/${completionBill.id}/status`, {
        status: 'completed',
        payment_status: completionPayment.payment_status,
        payment_mode: completionPayment.payment_mode,
        discount_amount: discount,
      });
      toast.success('Wash completed');
      closeCompletionModal();
      const shouldPrint = await confirm('Wash completed. Do you want to print the final bill now?', {
        title: 'Print Final Bill',
        confirmText: 'Print',
        variant: 'info',
        icon: '🖨️',
      });
      if (shouldPrint) printBill(completedBill);
      load();
    } catch {
      toast.error('Failed to complete wash');
    } finally {
      setUpdatingId(null);
    }
  };

  const completionSubtotal = completionBill ? Number(completionBill.total_amount || 0) + Number(completionBill.discount_amount || 0) : 0;
  const completionDiscount = Number(completionPayment.discount_amount) || 0;
  const completionAmountDue = Math.max(0, completionSubtotal - completionDiscount);

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Wash Status Board</h2><p>Track wash progress for all vehicles</p></div>
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
      </div>

      <div className="tabs">
        {['all', 'in_progress', 'completed'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => { setFilter(s); setPage(1); }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ transform: 'scale(0.45)', transformOrigin: 'left center', width: 50, height: 30, overflow: 'hidden', flexShrink: 0 }}>
                      {vtMiniIcon[b.vehicle_type] ? (() => { const C = vtMiniIcon[b.vehicle_type]; return <C selected={b.wash_status === 'in_progress'} mini={true} />; })() : null}
                    </div>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.2, wordBreak: 'break-word' }}>{b.vehicle_number || 'No plate'}</strong>
                  </div>
                  <span className={`badge ${statusColors[b.wash_status]}`}>{statusLabels[b.wash_status]}</span>
                </div>
                <div className="wash-card-body">
                  <p><strong>{b.vehicle_type}</strong> · {b.service_name}</p>
                  <p>Amount: ₹{Number(b.total_amount).toLocaleString()}</p>
                  {b.wash_status === 'completed' && (
                    <p>Payment: <span className={`badge ${b.payment_status === 'paid' ? 'badge-green' : 'badge-amber'}`}>{b.payment_status}</span></p>
                  )}
                  <p>By: {b.created_by_name}</p>
                  {user?.role === 'admin' && durationStr && <p style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>Wash Time: {durationStr}</p>}
                  {b.extras?.length > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Extras: {b.extras.map(e => e.name).join(', ')}</p>}
                </div>
                {nextStatus[b.wash_status] && (
                  <button
                    className={`btn btn-primary btn-sm wash-status-btn ${updatingId === b.id ? 'loading' : ''}`}
                    onClick={() => nextStatus[b.wash_status] === 'completed' ? openCompletionModal(b) : updateStatus(b.id, nextStatus[b.wash_status], statusLabels[nextStatus[b.wash_status]])}
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
      <Pagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />

      {completionBill && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={completeWash}>
            <div className="modal-header">
              <h3>Complete Wash</h3>
              <button type="button" className="btn-icon" onClick={closeCompletionModal}>×</button>
            </div>
            <div className="bill-summary" style={{ marginTop: 0, marginBottom: 20 }}>
              <div className="bill-summary-row"><span>Vehicle</span><span>{completionBill.vehicle_number || 'No plate'}</span></div>
              <div className="bill-summary-row"><span>Service</span><span>{completionBill.service_name}</span></div>
              <div className="bill-summary-row"><span>Subtotal</span><span className="amount">₹{completionSubtotal.toLocaleString()}</span></div>
              {completionDiscount > 0 && <div className="bill-summary-row"><span>Discount</span><span className="amount amount-red">-₹{completionDiscount.toLocaleString()}</span></div>}
              <div className="bill-summary-row total"><span>Amount Due</span><span className="amount">₹{completionAmountDue.toLocaleString()}</span></div>
            </div>
            <div className="form-group">
              <label>Discount</label>
              <input
                type="number"
                min="0"
                max={completionSubtotal}
                className="form-control"
                placeholder="0"
                value={completionPayment.discount_amount}
                onChange={e => setCompletionPayment(prev => ({ ...prev, discount_amount: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Payment Status</label>
              <select
                className="form-control"
                value={completionPayment.payment_status}
                onChange={e => setCompletionPayment(prev => ({ ...prev, payment_status: e.target.value }))}
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            {completionPayment.payment_status === 'paid' && (
              <div className="form-group">
                <label>Payment Mode</label>
                <select
                  className="form-control"
                  value={completionPayment.payment_mode}
                  onChange={e => setCompletionPayment(prev => ({ ...prev, payment_mode: e.target.value }))}
                >
                  <option value="cash">Cash (In Hand)</option>
                  <option value="account">Account (Online)</option>
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeCompletionModal}>Cancel</button>
              <button className={`btn btn-primary ${updatingId === completionBill.id ? 'loading' : ''}`} disabled={updatingId === completionBill.id}>
                {updatingId === completionBill.id ? <><Spinner size={14} /> Updating...</> : 'Complete Wash'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
