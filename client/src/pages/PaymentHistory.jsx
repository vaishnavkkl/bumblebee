import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { HiOutlineTrash, HiOutlineClock } from 'react-icons/hi';
import { SkeletonRow } from '../components/Loaders';
import Pagination from '../components/Pagination';
import toast, { Toaster } from 'react-hot-toast';

export default function PaymentHistory() {
  const { isAdmin } = useAuth();
  const { danger, confirm } = useAlert();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const getISTDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const [date, setDate] = useState(getISTDate());

  const formatPaymentDate = (value) => {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/billing/payments?date=${date}&page=${page}&limit=${limit}`);
      setPayments(r.data.data);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [date, page, limit]);

  const handleDelete = async (id) => {
    const ok = await danger('Delete this payment record? This cannot be undone.', {
      title: 'Delete Payment', confirmText: 'Delete'
    });
    if (!ok) return;
    try {
      await api.delete(`/billing/payments/${id}`);
      toast.success('Payment deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const handleMarkPending = async (billId, vehicleNumber) => {
    const ok = await confirm(
      `Mark bill for "${vehicleNumber || 'this vehicle'}" as Pending? This will move it back to the Pending Payments list.`,
      { title: 'Mark as Pending', confirmText: 'Mark Pending', variant: 'warning', icon: '⏳' }
    );
    if (!ok) return;
    try {
      await api.put(`/billing/${billId}/payment-status`, { status: 'pending' });
      toast.success('Bill marked as pending');
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const colCount = isAdmin ? 10 : 8;

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Payment History</h2><p>View and manage payment records</p></div>
      </div>

      <div className="filter-bar">
        <input type="date" className="form-control" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
        {!loading && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{total} records</span>}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Vehicle</th><th>Amount</th><th>Mode</th>
              <th>Type</th><th>Added By</th><th>Date</th><th>Time</th>
              {isAdmin && <th>Bill Action</th>}
              {isAdmin && <th>Delete</th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              : payments.length === 0
                ? <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No payments found</td></tr>
                : payments.map((p, i) => (
                    <tr key={p.id}>
                      <td>{(page - 1) * limit + i + 1}</td>
                      <td>{p.vehicle_number || '—'}</td>
                      <td><span className="amount amount-green">₹{Number(p.amount).toLocaleString()}</span></td>
                      <td><span className={`badge ${p.payment_mode === 'cash' ? 'badge-green' : 'badge-blue'}`}>{p.payment_mode}</span></td>
                      <td><span className={`badge ${p.is_advance ? 'badge-amber' : 'badge-blue'}`}>{p.is_advance ? 'Advance' : 'Payment'}</span></td>
                      <td>{p.created_by_name}</td>
                      <td>{formatPaymentDate(p.payment_date)}</td>
                      <td>{p.payment_time || '-'}</td>
                      {isAdmin && (
                        <td>
                          {p.bill_id && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Mark the associated bill as Pending"
                              onClick={() => handleMarkPending(p.bill_id, p.vehicle_number)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                            >
                              <HiOutlineClock /> Mark Pending
                            </button>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <button className="btn btn-danger btn-sm" title="Delete payment" onClick={() => handleDelete(p.id)}>
                            <HiOutlineTrash />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
            }
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
      </div>
    </div>
  );
}
