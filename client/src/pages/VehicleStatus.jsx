import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { BikeIcon, CarIcon, TruckIcon } from '../components/VehicleIcons';
import { Spinner } from '../components/Loaders';
import Pagination from '../components/Pagination';
import { printBill } from '../utils/printBill';
import { HiOutlinePrinter } from 'react-icons/hi';
import { useLocation } from 'react-router-dom';

const statusColors = { in_progress: 'badge-blue', completed: 'badge-green' };
const statusLabels = { in_progress: 'In Progress', completed: 'Completed' };
const nextStatus = { in_progress: 'completed' };
const vtMiniIcon = { Bike: BikeIcon, Car: CarIcon, 'Heavy Vehicle': TruckIcon };

const getPaymentLabel = (bill) => {
  if (bill.payment_status === 'paid') return 'Paid';
  if (Number(bill.paid_amount || 0) > 0 && Number(bill.balance_amount || 0) > 0) return 'Partial';
  return 'Pending';
};

const getPaymentBadge = (bill) => {
  const label = getPaymentLabel(bill);
  if (label === 'Paid') return 'badge-green';
  if (label === 'Partial') return 'badge-blue';
  return 'badge-amber';
};

export default function VehicleStatus() {
  const { confirm, danger } = useAlert();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState(location.state?.focusStatus || 'all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [completionBill, setCompletionBill] = useState(null);
  const [completionPayment, setCompletionPayment] = useState({ payment_status: 'paid', payment_mode: 'cash', discount_amount: '', paid_amount: '' });
  const [editBill, setEditBill] = useState(null);
  const [editForm, setEditForm] = useState({ vehicle_number: '', customer_mobile: '', discount_amount: '', service_id: '', extra_service_ids: [] });
  const [editServices, setEditServices] = useState([]);
  const [editExtras, setEditExtras] = useState([]);
  const [loadingEditCatalog, setLoadingEditCatalog] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const r = await api.get(`/billing?page=${page}&limit=${limit}${statusParam}`);
      setBills(r.data.data);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter, page, limit, location.state?.createdBillId]);

  useEffect(() => {
    if (location.state?.focusStatus) {
      setFilter(location.state.focusStatus);
      setPage(1);
    }
  }, [location.state?.focusStatus, location.state?.createdBillId]);

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
    setCompletionPayment({ payment_status: 'paid', payment_mode: 'cash', discount_amount: bill.discount_amount > 0 ? String(bill.discount_amount) : '', paid_amount: '' });
  };

  const closeCompletionModal = () => {
    setCompletionBill(null);
    setCompletionPayment({ payment_status: 'paid', payment_mode: 'cash', discount_amount: '', paid_amount: '' });
  };

  const handlePrintBill = async (bill) => {
    setUpdatingId(bill.id);
    try {
      await printBill(bill.id);
      toast.success('Receipt sent to printer');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to print receipt');
    } finally {
      setUpdatingId(null);
    }
  };

  const openEditModal = async (bill) => {
    const selectedExtraIds = (bill.extras || [])
      .map(extra => Number(extra.extra_service_id || extra.id))
      .filter(id => Number.isInteger(id) && id > 0);
    setEditBill(bill);
    setEditForm({
      vehicle_number: bill.vehicle_number || '',
      customer_mobile: bill.customer_mobile || '',
      discount_amount: Number(bill.discount_amount || 0) > 0 ? String(bill.discount_amount) : '',
      service_id: bill.service_id ? String(bill.service_id) : '',
      extra_service_ids: selectedExtraIds,
    });
    setLoadingEditCatalog(true);
    try {
      const [serviceRes, extraRes] = await Promise.all([
        api.get(`/vehicles/services?vehicleTypeId=${bill.vehicle_type_id}`),
        api.get('/vehicles/extra-services'),
      ]);
      setEditServices(serviceRes.data);
      setEditExtras(extraRes.data);
    } catch (err) {
      toast.error('Failed to load services for editing');
    } finally {
      setLoadingEditCatalog(false);
    }
  };

  const closeEditModal = () => {
    setEditBill(null);
    setEditForm({ vehicle_number: '', customer_mobile: '', discount_amount: '', service_id: '', extra_service_ids: [] });
    setEditServices([]);
    setEditExtras([]);
    setLoadingEditCatalog(false);
  };

  const toggleEditExtra = (id) => {
    setEditForm(prev => ({
      ...prev,
      extra_service_ids: prev.extra_service_ids.includes(id)
        ? prev.extra_service_ids.filter(extraId => extraId !== id)
        : [...prev.extra_service_ids, id],
    }));
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
    const paymentStatus = completionPayment.payment_status;
    const partialPaidAmount = Number(completionPayment.paid_amount) || 0;
    if (paymentStatus === 'partial' && (partialPaidAmount <= 0 || partialPaidAmount >= completionAmountDue)) {
      toast.error('Partial paid amount must be more than 0 and less than the amount due');
      return;
    }
    const paidAmount = paymentStatus === 'paid' ? completionAmountDue : paymentStatus === 'partial' ? partialPaidAmount : 0;
    setUpdatingId(completionBill.id);
    try {
      await api.put(`/billing/${completionBill.id}/status`, {
        status: 'completed',
        payment_status: paymentStatus,
        payment_mode: completionPayment.payment_mode,
        discount_amount: discount,
        paid_amount: paidAmount,
      });
      closeCompletionModal();
      toast.success('Wash completed');

      try {
        await printBill(completionBill.id);
        toast.success('Receipt sent to printer');
      } catch (printErr) {
        toast.error(printErr.response?.data?.message || printErr.message || 'Wash completed, but receipt printing failed');
      }

      load();
    } catch {
      toast.error('Failed to complete wash');
    } finally {
      setUpdatingId(null);
    }
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!editBill) return;
    if (!editForm.vehicle_number.trim()) {
      toast.error('Vehicle number is required');
      return;
    }
    const discount = Number(editForm.discount_amount) || 0;
    if (discount > editSubtotal) {
      toast.error('Discount cannot be more than the service total');
      return;
    }
    if (!editForm.service_id) {
      toast.error('Select a service');
      return;
    }

    setUpdatingId(editBill.id);
    try {
      await api.put(`/billing/${editBill.id}/details`, {
        vehicle_number: editForm.vehicle_number.trim(),
        customer_mobile: editForm.customer_mobile.trim(),
        discount_amount: discount,
        service_id: Number(editForm.service_id),
        extra_service_ids: editForm.extra_service_ids,
      });
      toast.success('Details updated');
      closeEditModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update details');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteBill = async (bill) => {
    const ok = await danger(`Delete bill #${bill.id} for ${bill.vehicle_number || 'No plate'}? This will remove linked payment and income records.`, {
      title: 'Delete Wash Record',
      confirmText: 'Delete',
    });
    if (!ok) return;

    setUpdatingId(bill.id);
    try {
      await api.delete(`/billing/${bill.id}`);
      toast.success('Wash record deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete wash record');
    } finally {
      setUpdatingId(null);
    }
  };

  const editService = editServices.find(service => String(service.id) === String(editForm.service_id));
  const editServiceOptions = editBill && editForm.service_id && !editServices.some(service => String(service.id) === String(editForm.service_id))
    ? [{ id: Number(editForm.service_id), name: editBill.service_name, price: editBill.service_price }, ...editServices]
    : editServices;
  const editServicePrice = editService ? Number(editService.price || 0) : Number(editBill?.service_price || 0);
  const editExtrasTotal = editForm.extra_service_ids.reduce((sum, id) => {
    const extra = editExtras.find(item => Number(item.id) === Number(id));
    return sum + Number(extra?.price || 0);
  }, 0);
  const editSubtotal = editBill ? editServicePrice + editExtrasTotal : 0;
  const editDiscount = Number(editForm.discount_amount) || 0;
  const editTotal = Math.max(0, editSubtotal - editDiscount);

  const completionSubtotal = completionBill ? Number(completionBill.total_amount || 0) + Number(completionBill.discount_amount || 0) : 0;
  const completionDiscount = Number(completionPayment.discount_amount) || 0;
  const completionAmountDue = Math.max(0, completionSubtotal - completionDiscount);
  const completionPaidAmount = completionPayment.payment_status === 'paid'
    ? completionAmountDue
    : completionPayment.payment_status === 'partial'
      ? Number(completionPayment.paid_amount) || 0
      : 0;
  const completionBalanceAmount = Math.max(completionAmountDue - completionPaidAmount, 0);

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
                  <p><strong>{b.vehicle_type}</strong> - {b.service_name}</p>
                  {b.workshop_name && <p>Workshop: {b.workshop_name}</p>}
                  <p>Amount: Rs. {Number(b.total_amount).toLocaleString()}</p>
                  {b.wash_status === 'completed' && (
                    <>
                      <p>Payment: <span className={`badge ${getPaymentBadge(b)}`}>{getPaymentLabel(b)}</span></p>
                      {Number(b.paid_amount || 0) > 0 && <p>Paid: Rs. {Number(b.paid_amount).toLocaleString()}</p>}
                      {Number(b.balance_amount || 0) > 0 && <p>Balance: <span className="amount amount-red">Rs. {Number(b.balance_amount).toLocaleString()}</span></p>}
                    </>
                  )}
                  <p>By: {b.created_by_name}</p>
                  {user?.role === 'admin' && durationStr && <p style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>Wash Time: {durationStr}</p>}
                  {b.extras?.length > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Extras: {b.extras.map(e => e.name).join(', ')}</p>}
                </div>
                <div className="wash-card-actions">
                  {nextStatus[b.wash_status] && (
                    <div className="wash-card-primary-action">
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
                    </div>
                  )}
                  <div className="wash-card-secondary-actions">
                    {b.wash_status === 'completed' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePrintBill(b)} disabled={updatingId === b.id}>
                        {updatingId === b.id ? <><Spinner size={12} /> Printing...</> : <><HiOutlinePrinter /> Print</>}
                      </button>
                    )}
                    {isAdmin && b.wash_status === 'completed' && (
                      <button
                        className={`btn btn-secondary btn-sm ${updatingId === b.id ? 'loading' : ''}`}
                        onClick={() => updateStatus(b.id, 'in_progress', 'In Progress')}
                        disabled={updatingId === b.id}
                      >
                        Revert
                      </button>
                    )}
                    {isAdmin && b.wash_status === 'in_progress' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(b)} disabled={updatingId === b.id}>
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteBill(b)} disabled={updatingId === b.id}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />

      {completionBill && (
        <div className="modal-overlay">
          <form className="modal complete-wash-modal" onSubmit={completeWash}>
            <div className="modal-header">
              <h3>Complete Wash</h3>
              <button type="button" className="btn-icon" onClick={closeCompletionModal}>x</button>
            </div>
            <div className="completion-action-bar">
              <div className="completion-action-total">
                <span>Amount Due</span>
                <strong>Rs. {completionAmountDue.toLocaleString()}</strong>
              </div>
              <div className="completion-action-buttons">
                <button type="button" className="btn btn-secondary" onClick={closeCompletionModal}>Cancel</button>
                <button className={`btn btn-primary ${updatingId === completionBill.id ? 'loading' : ''}`} disabled={updatingId === completionBill.id}>
                  {updatingId === completionBill.id ? <><Spinner size={14} /> Updating...</> : 'Complete Wash'}
                </button>
              </div>
            </div>
            <div className="completion-summary">
              <div className="completion-summary-item"><span>Vehicle</span><strong>{completionBill.vehicle_number || 'No plate'}</strong></div>
              <div className="completion-summary-item"><span>Service</span><strong>{completionBill.service_name}</strong></div>
              <div className="completion-summary-item"><span>Subtotal</span><strong>Rs. {completionSubtotal.toLocaleString()}</strong></div>
              {completionDiscount > 0 && <div className="completion-summary-item"><span>Discount</span><strong className="amount-red">-Rs. {completionDiscount.toLocaleString()}</strong></div>}
              {completionPayment.payment_status === 'partial' && (
                <>
                  <div className="completion-summary-item"><span>Paid Now</span><strong className="amount-green">Rs. {completionPaidAmount.toLocaleString()}</strong></div>
                  <div className="completion-summary-item"><span>Pending</span><strong className="amount-red">Rs. {completionBalanceAmount.toLocaleString()}</strong></div>
                </>
              )}
            </div>
            <div className="completion-field-grid">
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
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {completionPayment.payment_status === 'partial' && (
                <div className="form-group">
                  <label>Paid Amount</label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(completionAmountDue - 1, 1)}
                    className="form-control"
                    placeholder="Amount received"
                    value={completionPayment.paid_amount}
                    onChange={e => setCompletionPayment(prev => ({ ...prev, paid_amount: e.target.value }))}
                  />
                </div>
              )}
              {completionPayment.payment_status !== 'pending' && (
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
            </div>
          </form>
        </div>
      )}

      {editBill && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={saveDetails}>
            <div className="modal-header">
              <h3>Edit Bill Details</h3>
              <button type="button" className="btn-icon" onClick={closeEditModal}>x</button>
            </div>
            <div className="bill-summary" style={{ marginTop: 0, marginBottom: 20 }}>
              <div className="bill-summary-row"><span>Bill</span><span>#{editBill.id}</span></div>
              <div className="bill-summary-row"><span>Service</span><span>{editService?.name || editBill.service_name}</span></div>
              <div className="bill-summary-row"><span>Subtotal</span><span className="amount">Rs. {editSubtotal.toLocaleString()}</span></div>
              {editDiscount > 0 && <div className="bill-summary-row"><span>Discount</span><span className="amount amount-red">-Rs. {editDiscount.toLocaleString()}</span></div>}
              <div className="bill-summary-row total"><span>New Total</span><span className="amount">Rs. {editTotal.toLocaleString()}</span></div>
            </div>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input
                type="text"
                className="form-control"
                value={editForm.vehicle_number}
                onChange={e => setEditForm(prev => ({ ...prev, vehicle_number: e.target.value.toUpperCase() }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Customer Mobile</label>
              <input
                type="text"
                className="form-control"
                value={editForm.customer_mobile}
                onChange={e => setEditForm(prev => ({ ...prev, customer_mobile: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Service</label>
              <select
                className="form-control"
                value={editForm.service_id}
                onChange={e => setEditForm(prev => ({ ...prev, service_id: e.target.value }))}
                disabled={loadingEditCatalog}
                required
              >
                <option value="">Select service</option>
                {editServiceOptions.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} - Rs. {Number(service.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Extra Services</label>
              {loadingEditCatalog ? (
                <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
              ) : editExtras.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>No extra services available</p>
              ) : (
                <div className="extras-grid">
                  {editExtras.map(extra => (
                    <div
                      key={extra.id}
                      className={`extra-item ${editForm.extra_service_ids.includes(Number(extra.id)) ? 'selected' : ''}`}
                      onClick={() => toggleEditExtra(Number(extra.id))}
                    >
                      <input type="checkbox" checked={editForm.extra_service_ids.includes(Number(extra.id))} readOnly />
                      <span className="extra-label">{extra.name}</span>
                      <span className="extra-price">Rs. {Number(extra.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Discount</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={editForm.discount_amount}
                onChange={e => setEditForm(prev => ({ ...prev, discount_amount: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
              <button className={`btn btn-primary ${updatingId === editBill.id ? 'loading' : ''}`} disabled={updatingId === editBill.id}>
                {updatingId === editBill.id ? <><Spinner size={14} /> Saving...</> : 'Save Details'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
