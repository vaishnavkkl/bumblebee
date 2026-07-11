import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HiOutlineCheck } from 'react-icons/hi';
import { BikeIcon, CarIcon, TruckIcon } from '../components/VehicleIcons';
import { Spinner } from '../components/Loaders';

export default function NewBill() {
  const { alert: showAlert, confirm } = useAlert();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [extras, setExtras] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVT, setSelectedVT] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const serviceSectionRef = useRef(null);
  const extrasSectionRef = useRef(null);
  const detailsSectionRef = useRef(null);

  const vtComponents = { bike: BikeIcon, car: CarIcon, heavy: TruckIcon };

  const scrollToSection = (ref) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  useEffect(() => {
    setLoadingTypes(true);
    Promise.all([
      api.get('/vehicles/types'),
      api.get('/vehicles/extra-services'),
      api.get('/employees'),
      api.get('/workshops'),
    ]).then(([types, exSvcs, emps, workshopRes]) => {
      setVehicleTypes(types.data);
      setExtras(exSvcs.data);
      setWorkshops(workshopRes.data);
      const activeUsers = emps.data.filter(u => u.is_active);
      const hasCurrentUser = activeUsers.some(u => Number(u.id) === Number(user?.id));
      setUsers(hasCurrentUser || !user ? activeUsers : [{ ...user, is_active: 1 }, ...activeUsers]);
    }).finally(() => setLoadingTypes(false));
  }, [user]);

  useEffect(() => {
    if (user?.id) setCreatedBy(String(user.id));
  }, [user]);

  useEffect(() => {
    if (selectedVT) {
      setLoadingServices(true);
      api.get(`/vehicles/services?vehicleTypeId=${selectedVT}`)
        .then(r => setServices(r.data))
        .finally(() => setLoadingServices(false));
      setSelectedService(null);
      setSelectedExtras([]);
      scrollToSection(serviceSectionRef);
    }
  }, [selectedVT]);

  useEffect(() => {
    if (selectedService) scrollToSection(extrasSectionRef);
  }, [selectedService]);

  const toggleExtra = (id) => {
    setSelectedExtras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleVehicleTypeSelect = (id) => {
    setSelectedVT(id);
  };

  const handleServiceSelect = (id) => {
    setSelectedService(id);
    setSelectedExtras([]);
  };

  const servicePrice = selectedService ? services.find(s => s.id === selectedService)?.price || 0 : 0;
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + Number(extras.find(e => e.id === id)?.price || 0), 0);
  const totalAmount = Number(servicePrice) + extrasTotal;

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
    if (!createdBy) { showAlert('Please select who is creating this bill.', { title: 'Select User', icon: '👤', variant: 'warning' }); return; }
    if (!vehicleNumber.trim()) { showAlert('Please enter the vehicle number.', { title: 'Vehicle Number Required', icon: '!', variant: 'warning' }); return; }
    setSubmitting(true);
    try {
      const response = await api.post('/billing', {
        vehicle_type_id: selectedVT, vehicle_number: vehicleNumber.trim(),
        customer_mobile: customerMobile,
        workshop_id: selectedWorkshop || null,
        service_id: selectedService, extra_service_ids: selectedExtras,
        created_by: createdBy,
      });
      toast.success('Bill created successfully!');
      const goToWashStatus = await confirm(
        'Bill created and added to the wash queue. Complete the wash from Vehicle Status to record payment and print the final bill.',
        {
          title: `Bill #${response.data.id} Created`,
          confirmText: 'Go to Wash Status',
          cancelText: 'Stay Here',
          variant: 'success',
          icon: '✓',
        }
      );

      setSelectedVT(null); setSelectedService(null); setSelectedExtras([]);
      setVehicleNumber(''); setCustomerMobile(''); setSelectedWorkshop(''); setCreatedBy(user?.id ? String(user.id) : '');
      if (goToWashStatus) navigate('/vehicles/status', { state: { focusStatus: 'in_progress', createdBillId: response.data.id } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bill');
    } finally { setSubmitting(false); }
  };

  const handlePrintReceipt = (bill) => {
    return;
    
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
          <title>Bumblebee Bill - #${bill.id}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10mm; margin: 0; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
            .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
          </style>
        </head>
        <body>
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
            <div class="row"><span>Subtotal:</span> <span>₹${bill.subtotal}</span></div>
            ${bill.discount_amount > 0 ? `<div class="row"><span>Discount:</span> <span>-₹${bill.discount_amount}</span></div>` : ''}
            <div class="row"><span>Amount Due:</span> <span>₹${bill.total_amount}</span></div>
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
              onClick={() => handleVehicleTypeSelect(vt.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`vehicle-type-card vehicle-type-${vt.name} ${selectedVT === vt.id ? 'selected' : ''}`}>
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
        <div ref={serviceSectionRef} className="bill-step-section">
          <h3 className="section-title">2. Select Service</h3>
          {loadingServices ? (
            <div className="service-chips">
              {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 40, width: 140, borderRadius: 999 }} />)}
            </div>
          ) : (
            <div className="service-chips">
              {services.map(s => (
                <div key={s.id} className={`service-chip ${selectedService === s.id ? 'selected' : ''}`} onClick={() => handleServiceSelect(s.id)}>
                  {selectedService === s.id && <HiOutlineCheck />}
                  {s.name}
                  <span className="chip-price">₹{Number(s.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Extras */}
      {selectedService && (
        <div ref={extrasSectionRef} className="bill-step-section">
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => scrollToSection(detailsSectionRef)}
          >
            Continue to Details
          </button>
        </div>
      )}

      {/* Step 4: Details */}
      {selectedService && (
        <div ref={detailsSectionRef} className="bill-step-section">
          <h3 className="section-title">4. Vehicle & Staff Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Vehicle Number</label>
              <div style={{ position: 'relative' }}>
                <input type="text" className="form-control" placeholder="KA-01-AB-1234" value={vehicleNumber} onChange={handleVehicleNumberChange} required />
              </div>
            </div>
            <div className="form-group">
              <label>Customer Mobile (Optional)</label>
              <input type="text" className="form-control" placeholder="98XXXXXXXX" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Workshop</label>
            <select className="form-control" value={selectedWorkshop} onChange={e => setSelectedWorkshop(e.target.value)}>
              <option value="">Direct customer / no workshop</option>
              {workshops.map(workshop => (
                <option key={workshop.id} value={workshop.id}>{workshop.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Bill Created By</label>
            <select className="form-control" value={createdBy} onChange={e => setCreatedBy(e.target.value)} required>
              <option value="">Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          {/* Bill Summary */}
          <div className="bill-summary">
            <div className="bill-summary-row"><span>Service</span><span className="amount">₹{Number(servicePrice).toLocaleString()}</span></div>
            {selectedExtras.length > 0 && <div className="bill-summary-row"><span>Extras ({selectedExtras.length})</span><span className="amount">₹{extrasTotal.toLocaleString()}</span></div>}
            <div className="bill-summary-row total"><span>Estimated Amount Due After Wash</span><span className="amount">₹{totalAmount.toLocaleString()}</span></div>
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
        </div>
      )}
    </div>
  );
}
