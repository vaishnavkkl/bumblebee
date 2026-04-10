import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { HiOutlineTrash } from 'react-icons/hi';
import { SkeletonRow } from '../components/Loaders';
import toast, { Toaster } from 'react-hot-toast';

export default function PaymentHistory() {
  const { isAdmin } = useAuth();
  const { danger } = useAlert();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const getISTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    return nd.toISOString().split('T')[0];
  };
  const [date, setDate] = useState(getISTDate());

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/billing/payments?date=${date}`);
      setPayments(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [date]);

  const handleDelete = async (id) => {
    const ok = await danger(`Delete this payment record? This cannot be undone.`, {
      title: 'Delete Payment', confirmText: 'Delete'
    });
    if (!ok) return;
    try {
      await api.delete(`/billing/payments/${id}`);
      toast.success('Payment deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Payment History</h2>
          <p>View and manage payment records</p>
        </div>
      </div>

      <div className="filter-bar">
        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
        {loading && <div className="dot-loader"><span/><span/><span/></div>}
        {!loading && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{payments.length} records</span>}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Vehicle</th><th>Amount</th><th>Mode</th>
              <th>Type</th><th>Added By</th><th>Time</th>
              {isAdmin && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 8 : 7} />)
              : payments.length === 0
                ? <tr><td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No payments found</td></tr>
                : payments.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>{p.vehicle_number || '—'}</td>
                      <td><span className="amount amount-green">₹{Number(p.amount).toLocaleString()}</span></td>
                      <td><span className={`badge ${p.payment_mode === 'cash' ? 'badge-green' : 'badge-blue'}`}>{p.payment_mode}</span></td>
                      <td><span className={`badge ${p.is_advance ? 'badge-amber' : 'badge-blue'}`}>{p.is_advance ? 'Advance' : 'Payment'}</span></td>
                      <td>{p.created_by_name}</td>
                      <td>{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                            <HiOutlineTrash />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
