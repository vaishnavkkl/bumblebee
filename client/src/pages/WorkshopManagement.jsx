import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../utils/api';
import { Spinner, SkeletonRow } from '../components/Loaders';
import { useAlert } from '../context/AlertContext';

const emptyForm = { id: null, name: '', contact_person: '', phone: '', address: '', notes: '', is_active: 1 };

export default function WorkshopManagement() {
  const { danger } = useAlert();
  const [workshops, setWorkshops] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadWorkshops = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workshops?includeInactive=1');
      setWorkshops(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkshops();
  }, []);

  const resetForm = () => setForm(emptyForm);

  const saveWorkshop = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        is_active: Number(form.is_active),
      };
      if (form.id) {
        await api.put(`/workshops/${form.id}`, payload);
        toast.success('Workshop updated');
      } else {
        await api.post('/workshops', payload);
        toast.success('Workshop added');
      }
      resetForm();
      await loadWorkshops();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save workshop');
    } finally {
      setSaving(false);
    }
  };

  const editWorkshop = (workshop) => {
    setForm({
      id: workshop.id,
      name: workshop.name || '',
      contact_person: workshop.contact_person || '',
      phone: workshop.phone || '',
      address: workshop.address || '',
      notes: workshop.notes || '',
      is_active: Number(workshop.is_active) ? 1 : 0,
    });
  };

  const deleteWorkshop = async (workshop) => {
    const ok = await danger(`Remove "${workshop.name}" from new bills? Existing bills will keep the workshop name.`, {
      title: 'Remove Workshop',
      confirmText: 'Remove',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.delete(`/workshops/${workshop.id}`);
      toast.success('Workshop removed');
      await loadWorkshops();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove workshop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Workshop Management</h2>
          <p>Add workshops used for bulk wash billing.</p>
        </div>
      </div>

      <form className="card catalog-form" onSubmit={saveWorkshop}>
        <h3 className="section-title">{form.id ? 'Edit Workshop' : 'Add Workshop'}</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Workshop Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input className="form-control" value={form.contact_person} onChange={e => setForm(prev => ({ ...prev, contact_person: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: Number(e.target.value) }))}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Address</label>
          <textarea className="form-control" rows="2" value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-control" rows="2" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <><Spinner size={16} /> Saving...</> : form.id ? 'Update Workshop' : 'Add Workshop'}
          </button>
          {form.id && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel Edit</button>}
        </div>
      </form>

      <div className="table-container" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Workshop</th><th>Contact</th><th>Phone</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              : workshops.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No workshops added</td></tr>
                : workshops.map(workshop => (
                    <tr key={workshop.id}>
                      <td>
                        <strong>{workshop.name}</strong>
                        {workshop.address && <small style={{ display: 'block', color: 'var(--text-tertiary)' }}>{workshop.address}</small>}
                      </td>
                      <td>{workshop.contact_person || '-'}</td>
                      <td>{workshop.phone || '-'}</td>
                      <td><span className={`badge ${Number(workshop.is_active) ? 'badge-green' : 'badge-red'}`}>{Number(workshop.is_active) ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => editWorkshop(workshop)}>Edit</button>
                          {Number(workshop.is_active) === 1 && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteWorkshop(workshop)} disabled={saving}>Remove</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
