import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { useAlert } from '../context/AlertContext';
import { HiOutlineCheck } from 'react-icons/hi';
import { BikeIcon, CarIcon, TruckIcon } from '../components/VehicleIcons';
import { Spinner } from '../components/Loaders';

export default function NewBill() {
  const { alert: showAlert, confirm } = useAlert();
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [extras, setExtras] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVT, setSelectedVT] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  const vtComponents = { bike: BikeIcon, car: CarIcon, heavy: TruckIcon };

  useEffect(() => {
    setLoadingTypes(true);
    Promise.all([
      api.get('/vehicles/types'),
      api.get('/vehicles/extra-services'),
      api.get('/employees'),
    ]).then(([types, exSvcs, emps]) => {
      setVehicleTypes(types.data);
      setExtras(exSvcs.data);
      setUsers(emps.data.filter(u => u.is_active));
    }).finally(() => setLoadingTypes(false));
  }, []);

  useEffect(() => {
    if (selectedVT) {
      setLoadingServices(true);
      api.get(`/vehicles/services?vehicleTypeId=${selectedVT}`)
        .then(r => setServices(r.data))
        .finally(() => setLoadingServices(false));
      setSelectedService(null);
    }
  }, [selectedVT]);

  const toggleExtra = (id) => {
    setSelectedExtras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const servicePrice = selectedService ? services.find(s => s.id === selectedService)?.price || 0 : 0;
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + Number(extras.find(e => e.id === id)?.price || 0), 0);
  const totalAmount = Number(servicePrice) + extrasTotal;
  const advance = Number(advanceAmount) || 0;
  const paidAmount = paymentStatus === 'pending' ? 0 : totalAmount - advance;

  const handleVehicleNumberChange = (e) => {
    const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let formatted = '';
    
    // Extract format sections: State(letters), RTO(digits), Series(letters), Number(digits)
    const match = raw.match(/^([A-Z]{1,2})?([0-9]{1,2})?([A-Z]{1,3})?([0-9]{1,4})?/);

    if (match && match[0]) {
      const parts = [];
      if (match[1]) parts.push(match[1]);
      if (match[2]) parts.push(match[2]);
      if (match[3]) parts.push(match[3]);
      if (match[4]) parts.push(match[4]);
      
      formatted = parts.join('-');
      
      const remainder = raw.slice(match[0].length);
      if (remainder) formatted += '-' + remainder;
    } else {
      formatted = raw;
    }
    
    setVehicleNumber(formatted.slice(0, 15));
  };

  const handleSubmit = async () => {
    if (!selectedVT || !selectedService) { showAlert('Please select a vehicle type and service.', { title: 'Missing Selection', icon: '🚗', variant: 'warning' }); return; }
    if (!createdBy) { showAlert('Please select who is adding this payment.', { title: 'Select User', icon: '👤', variant: 'warning' }); return; }
    try {
      const response = await api.post('/billing', {
        vehicle_type_id: selectedVT, vehicle_number: vehicleNumber,
        customer_mobile: customerMobile,
        service_id: selectedService, extra_service_ids: selectedExtras,
        total_amount: totalAmount, paid_amount: paidAmount,
        advance_amount: advance, payment_mode: paymentMode,
        payment_status: paymentStatus,
      });
      toast.success('Bill created successfully!');
      
      const printNow = await confirm('Do you want to print the receipt now?', { title: 'Print Receipt', confirmText: 'Print', variant: 'info', icon: '🖨️' });
      if (printNow) {
        handlePrintReceipt({
          id: response.data.id,
          vehicle_number: vehicleNumber,
          customer_mobile: customerMobile,
          vehicle_type: vehicleTypes.find(v => v.id === selectedVT)?.label,
          service_name: services.find(s => s.id === selectedService)?.name,
          service_price: services.find(s => s.id === selectedService)?.price,
          extras: selectedExtras.map(id => {
            const ext = extras.find(e => e.id === id);
            return { name: ext?.name, price: ext?.price };
          }),
          total_amount: totalAmount,
          paid_amount: paidAmount,
          advance_amount: advance,
          created_at: new Date().toISOString()
        });
      }

      setSelectedVT(null); setSelectedService(null); setSelectedExtras([]);
      setVehicleNumber(''); setCustomerMobile(''); setAdvanceAmount(''); setPaymentMode('cash'); setPaymentStatus('paid'); setCreatedBy('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    } finally { setSubmitting(false); }
  };

  const handlePrintReceipt = (bill) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    let extrasHtml = '';
    if (bill.extras && bill.extras.length > 0) {
      extrasHtml = bill.extras.map(e => `
        <div class="row" style="font-size:12px; margin-left: 10px;">
          <span>- ${e.name}</span>
          <span>₹${e.price}</span>
        </div>
      `).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Bumblebee Receipt - #${bill.id}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10mm; margin: 0; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
            .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(function(){ window.close(); }, 500);">
          <div class="header">
            <h2 style="margin:0;">BUMBLEBEE</h2>
            <p style="margin:0; font-size:12px;">Premium Car Wash</p>
          </div>
          <div class="row"><span>Bill No:</span> <span>#${bill.id}</span></div>
          <div class="row"><span>Date:</span> <span>${new Date(bill.created_at).toLocaleString()}</span></div>
          <div class="row"><span>Vehicle:</span> <span>${bill.vehicle_number || 'N/A'}</span></div>
          ${bill.customer_mobile ? `<div class="row"><span>Mobile:</span> <span>${bill.customer_mobile}</span></div>` : ''}
          <div class="row"><span>Type:</span> <span>${bill.vehicle_type}</span></div>
          <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
          <div class="row" style="margin-bottom:2px;"><strong>Service:</strong></div>
          <div class="row" style="font-size:12px; margin-left:10px;">
            <span>- ${bill.service_name}</span> <span>₹${bill.service_price}</span>
          </div>
          ${bill.extras && bill.extras.length > 0 ? `<div class="row" style="margin-top:5px; margin-bottom:2px;"><strong>Extras:</strong></div>${extrasHtml}` : ''}
          <div class="total">
            <div class="row"><span>Total:</span> <span>₹${bill.total_amount}</span></div>
            ${bill.advance_amount > 0 ? `<div class="row"><span>Advance Paid:</span> <span>₹${bill.advance_amount}</span></div>` : ''}
            <div class="row"><span>Balance Paid:</span> <span>₹${bill.paid_amount}</span></div>
          </div>
          <div class="footer">
            <p>Thank you for visiting!</p>
            <p>Please visit again.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Create New Bill</h2><p>Select vehicle type, service, and extras</p></div>
      </div>

      {/* Step 1: Vehicle Type */}
      <h3 className="section-title">1. Select Vehicle Type</h3>
      {loadingTypes ? (
        <div className="vehicle-type-grid">
          {[0,1,2].map(i => (
            <div key={i} className="vehicle-type-card" style={{ minHeight: 180 }}>
              <div className="skeleton" style={{ height: 140, borderRadius: 10, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="vehicle-type-grid">
          {vehicleTypes.map(vt => (
            <div 
              key={vt.id} 
              className="vehicle-type-container"
              onClick={() => setSelectedVT(vt.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`vehicle-type-card ${selectedVT === vt.id ? 'selected' : ''}`}>
                <div id={`vt-icon-${vt.id}`} className="vt-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  {vtComponents[vt.name] ? (() => { 
                    const Comp = vtComponents[vt.name]; 
                    return <Comp selected={selectedVT === vt.id} />; 
                  })() : '🚗'}
                </div>
              </div>
              <div className="vt-label" style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '12px', color: selectedVT === vt.id ? 'var(--accent)' : 'var(--text-primary)', transition: 'color 0.2s' }}>{vt.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Service */}
      {selectedVT && (
        <>
          <h3 className="section-title">2. Select Service</h3>
          {loadingServices ? (
            <div className="service-chips">
              {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 40, width: 140, borderRadius: 999 }} />)}
            </div>
          ) : (
            <div className="service-chips">
              {services.map(s => (
                <div key={s.id} className={`service-chip ${selectedService === s.id ? 'selected' : ''}`} onClick={() => setSelectedService(s.id)}>
                  {selectedService === s.id && <HiOutlineCheck />}
                  {s.name}
                  <span className="chip-price">₹{Number(s.price)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step 3: Extras */}
      {selectedService && (
        <>
          <h3 className="section-title">3. Extra Services <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.8rem' }}>(Optional)</span></h3>
          <div className="extras-grid">
            {extras.map(ex => (
              <div key={ex.id} className={`extra-item ${selectedExtras.includes(ex.id) ? 'selected' : ''}`} onClick={() => toggleExtra(ex.id)}>
                <input type="checkbox" checked={selectedExtras.includes(ex.id)} readOnly />
                <span className="extra-label">{ex.name}</span>
                <span className="extra-price">₹{Number(ex.price)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Step 4: Details */}
      {selectedService && (
        <>
          <h3 className="section-title">4. Vehicle & Payment Details</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Vehicle Number</label>
              <div style={{ position: 'relative' }}>
                <input type="text" className="form-control" placeholder="KA-01-AB-1234" value={vehicleNumber} onChange={handleVehicleNumberChange} />
              </div>
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="cash">Cash (In Hand)</option>
                <option value="account">Account (Online)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payment Status (Optional)</label>
              <select className="form-control" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="form-group">
              <label>Advance Amount</label>
              <input type="number" className="form-control" placeholder="0" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Customer Mobile (Optional)</label>
              <input type="text" className="form-control" placeholder="98XXXXXXXX" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} />
              {paymentStatus === 'pending' && !customerMobile && (
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginTop: 4, display: 'block' }}>⚠️ Recommended for pending payments</span>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Payment Added By</label>
            <select className="form-control" value={createdBy} onChange={e => setCreatedBy(e.target.value)} required>
              <option value="">Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          {/* Bill Summary */}
          <div className="bill-summary">
            <div className="bill-summary-row"><span>Service</span><span className="amount">₹{Number(servicePrice).toLocaleString()}</span></div>
            {selectedExtras.length > 0 && <div className="bill-summary-row"><span>Extras ({selectedExtras.length})</span><span className="amount">₹{extrasTotal.toLocaleString()}</span></div>}
            {advance > 0 && <div className="bill-summary-row"><span>Advance</span><span className="amount amount-red">-₹{advance.toLocaleString()}</span></div>}
            <div className="bill-summary-row total"><span>Total</span><span className="amount">₹{totalAmount.toLocaleString()}</span></div>
          </div>

          <button
            className={`btn btn-primary ${submitting ? 'loading' : ''}`}
            style={{ marginTop: 20, width: '100%', justifyContent: 'center', padding: '14px' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <><Spinner size={16} /> <span className="btn-text">Creating Bill...</span></>
              : `Create Bill — ₹${totalAmount.toLocaleString()}`
            }
          </button>
        </>
      )}
    </div>
  );
}
