import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SkeletonRow } from '../components/Loaders';
import Pagination from '../components/Pagination';
import toast, { Toaster } from 'react-hot-toast';
import { HiOutlineCheck } from 'react-icons/hi';

export default function PendingPayments() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [payingId, setPayingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/billing?payment_status=pending&page=${page}&limit=${limit}`);
      setBills(r.data.data);
      setTotal(r.data.total);
    } catch (err) {
      toast.error('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [page, limit]);

  const openPaymentModal = (bill) => {
    setPaymentBill(bill);
    setPaymentMode('cash');
  };

  const closePaymentModal = () => {
    setPaymentBill(null);
    setPaymentMode('cash');
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!paymentBill) return;
    setPayingId(paymentBill.id);
    try {
      await api.put(`/billing/${paymentBill.id}/payment-status`, { status: 'paid', payment_mode: paymentMode });
      toast.success('Payment recorded successfully');
      closePaymentModal();
      load();
    } catch (err) {
      toast.error('Failed to update payment status');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Pending Payments</h2>
          <p>View customers with pending payments</p>
        </div>
        {!loading && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{total} pending</span>}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Bill #</th><th>Vehicle</th><th>Customer</th>
              <th>Total Amount</th><th>Balance</th><th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : bills.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No pending payments</td></tr>
                : bills.map((b) => (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>{b.vehicle_number || '—'}</td>
                      <td>{b.customer_mobile || '—'}</td>
                      <td>₹{Number(b.total_amount).toLocaleString()}</td>
                      <td><span className="amount amount-red">₹{Number(b.balance_amount).toLocaleString()}</span></td>
                      <td>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => openPaymentModal(b)}>
                          <HiOutlineCheck /> Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
      </div>

      {paymentBill && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={handleMarkPaid}>
            <div className="modal-header">
              <h3>Complete Payment</h3>
              <button type="button" className="btn-icon" onClick={closePaymentModal}>×</button>
            </div>
            <div className="bill-summary" style={{ marginTop: 0, marginBottom: 20 }}>
              <div className="bill-summary-row"><span>Vehicle</span><span>{paymentBill.vehicle_number || 'No plate'}</span></div>
              <div className="bill-summary-row total"><span>Balance</span><span className="amount">₹{Number(paymentBill.balance_amount).toLocaleString()}</span></div>
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="cash">Cash (In Hand)</option>
                <option value="account">Account (Online)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closePaymentModal}>Cancel</button>
              <button className={`btn btn-primary ${payingId === paymentBill.id ? 'loading' : ''}`} disabled={payingId === paymentBill.id}>
                {payingId === paymentBill.id ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
