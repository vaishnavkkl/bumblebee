import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../utils/api';
import { Spinner } from '../components/Loaders';
import { useAlert } from '../context/AlertContext';

export default function ServiceCatalog() {
  const { danger } = useAlert();
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});

  const [serviceForm, setServiceForm] = useState({ vehicle_type_id: '', name: '', price: '' });
  const [extraForm, setExtraForm] = useState({ name: '', price: '' });

  const servicesByType = useMemo(() => {
    return vehicleTypes.map(type => ({
      ...type,
      services: services.filter(service => service.vehicle_type_id === type.id || service.vehicle_type_name === type.name),
    }));
  }, [services, vehicleTypes]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [typesRes, servicesRes, extrasRes] = await Promise.all([
        api.get('/vehicles/types'),
        api.get('/vehicles/services'),
        api.get('/vehicles/extra-services'),
      ]);
      setVehicleTypes(typesRes.data);
      setServices(servicesRes.data);
      setExtras(extrasRes.data);
      setServiceForm(prev => ({
        ...prev,
        vehicle_type_id: prev.vehicle_type_id || typesRes.data[0]?.id || '',
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load service catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleAddService = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/vehicles/services', {
        vehicle_type_id: serviceForm.vehicle_type_id,
        name: serviceForm.name,
        price: serviceForm.price,
      });
      toast.success('Service added');
      setServiceForm(prev => ({ ...prev, name: '', price: '' }));
      await loadCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add service');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExtra = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/vehicles/extra-services', extraForm);
      toast.success('Extra service added');
      setExtraForm({ name: '', price: '' });
      await loadCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add extra service');
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (key, value) => {
    setEditingPrices(prev => ({ ...prev, [key]: value }));
  };

  const handleUpdatePrice = async (type, id, currentPrice) => {
    const key = `${type}-${id}`;
    const nextPrice = editingPrices[key] ?? currentPrice;
    setSaving(true);
    try {
      const url = type === 'service' ? `/vehicles/services/${id}/price` : `/vehicles/extra-services/${id}/price`;
      await api.put(url, { price: nextPrice });
      toast.success('Cost updated');
      setEditingPrices(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      await loadCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update cost');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, item) => {
    const label = type === 'service' ? 'service' : 'extra service';
    const ok = await danger(`Delete "${item.name}"? Old bills will keep their history, and this item will be hidden from new bills.`, {
      title: `Delete ${label}`,
      confirmText: 'Delete',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const url = type === 'service' ? `/vehicles/services/${item.id}` : `/vehicles/extra-services/${item.id}`;
      await api.delete(url);
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`);
      await loadCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to delete ${label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in service-catalog-page">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Service Catalog</h2>
          <p>Add services for bike, car, and truck billing. Set the cost used on new bills.</p>
        </div>
      </div>

      <div className="catalog-actions">
        <form className="card catalog-form" onSubmit={handleAddService}>
          <h3 className="section-title">Add Vehicle Service</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Vehicle Type</label>
              <select
                className="form-control"
                value={serviceForm.vehicle_type_id}
                onChange={e => setServiceForm(prev => ({ ...prev, vehicle_type_id: e.target.value }))}
                required
              >
                {vehicleTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Service Name</label>
              <input
                className="form-control"
                value={serviceForm.name}
                onChange={e => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Example: Ceramic Wash"
                required
              />
            </div>
            <div className="form-group">
              <label>Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={serviceForm.price}
                onChange={e => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving || loading}>
            {saving ? <><Spinner size={16} /> Saving...</> : 'Add Service'}
          </button>
        </form>

        <form className="card catalog-form" onSubmit={handleAddExtra}>
          <h3 className="section-title">Add Extra Service</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Extra Service</label>
              <input
                className="form-control"
                value={extraForm.name}
                onChange={e => setExtraForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Example: Engine Degreasing"
                required
              />
            </div>
            <div className="form-group">
              <label>Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={extraForm.price}
                onChange={e => setExtraForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving || loading}>
            {saving ? <><Spinner size={16} /> Saving...</> : 'Add Extra'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="section-loader"><div className="spinner-ring-sm" /> Loading catalog...</div>
      ) : (
        <>
          <div className="catalog-grid">
            {servicesByType.map(type => (
              <div className="card catalog-panel" key={type.id}>
                <div className="catalog-panel-header">
                  <h3>{type.label}</h3>
                  <span className="badge badge-amber">{type.services.length} services</span>
                </div>
                <div className="catalog-list">
                  {type.services.length === 0 ? (
                    <div className="empty-row">No services added.</div>
                  ) : type.services.map(service => {
                    const key = `service-${service.id}`;
                    return (
                      <div className="catalog-row" key={service.id}>
                        <span className="catalog-name">{service.name}</span>
                        <div className="catalog-row-controls">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control catalog-price-input"
                            value={editingPrices[key] ?? service.price}
                            onChange={e => handlePriceChange(key, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUpdatePrice('service', service.id, service.price)}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete('service', service)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card catalog-panel">
            <div className="catalog-panel-header">
              <h3>Extra Services</h3>
              <span className="badge badge-blue">{extras.length} extras</span>
            </div>
            <div className="catalog-list catalog-list-wide">
              {extras.map(extra => {
                const key = `extra-${extra.id}`;
                return (
                  <div className="catalog-row" key={extra.id}>
                    <span className="catalog-name">{extra.name}</span>
                    <div className="catalog-row-controls">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control catalog-price-input"
                        value={editingPrices[key] ?? extra.price}
                        onChange={e => handlePriceChange(key, e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleUpdatePrice('extra', extra.id, extra.price)}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete('extra', extra)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
