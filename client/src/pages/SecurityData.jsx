import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineShieldCheck, HiOutlineCloudDownload, HiOutlineTrash, HiOutlineExclamationCircle } from 'react-icons/hi';
import api from '../utils/api'; // Or use native fetch with token if api is not available

export default function SecurityData() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState('full'); // 'full' | 'month'
  const [deleteMonth, setDeleteMonth] = useState('');
  const [password, setPassword] = useState('');

  const handleBackup = async (e) => {
    e.preventDefault();
    
    // We might need password confirmation for backup too, for extra security
    const pwd = window.prompt("Enter admin password to generate backup:");
    if (!pwd) return;

    setIsBackingUp(true);
    try {
      const res = await api.post('/system/backup', { password: pwd }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('bb-token')}` }
      });
      
      toast.success(res.data.message, { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error occurred during backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleClearDataSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error("Password is required");
      return;
    }
    
    if (deleteType === 'month' && !deleteMonth) {
      toast.error("Please select a month");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.post(`/system/clear`, {
        password,
        type: deleteType,
        month: deleteMonth
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('bb-token')}` }
      });
      
      toast.success(res.data.message);
      setShowDeleteModal(false);
      setPassword('');
      setDeleteMonth('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error occurred during data removal');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="security-page" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem', color: '#1f2937' }}>
          <HiOutlineShieldCheck /> Security & Data
        </h1>
        <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
          Manage your local backups and system data. Auto backup is disabled as per user configuration. Use the local backup folder to sync with Google Drive manually.
        </p>
      </div>

      <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Backup Card */}
        <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: '#e0f2fe', padding: '1rem', borderRadius: '50%', color: '#0284c7', fontSize: '1.5rem' }}>
              <HiOutlineCloudDownload />
            </div>
            <h2 style={{ fontSize: '1.25rem', color: '#111827', margin: 0 }}>Generate Backup</h2>
          </div>
          <p style={{ color: '#4b5563', marginBottom: '1.5rem', minHeight: '48px' }}>
            Generate a full snapshot of the database. The backup file will be saved securely to the local server `backups` folder so you can manually upload it to personal Google Drive.
          </p>
          <button 
            onClick={handleBackup} 
            disabled={isBackingUp}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: isBackingUp ? 'not-allowed' : 'pointer',
              opacity: isBackingUp ? 0.7 : 1,
              transition: 'background 0.2s'
            }}
          >
            {isBackingUp ? 'Generating Backup...' : 'Generate New Backup'}
          </button>
        </div>

        {/* Clear Data Card */}
        <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
             <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '50%', color: '#e11d48', fontSize: '1.5rem' }}>
              <HiOutlineTrash />
            </div>
            <h2 style={{ fontSize: '1.25rem', color: '#111827', margin: 0 }}>Clear System Data</h2>
          </div>
          <p style={{ color: '#4b5563', marginBottom: '1.5rem', minHeight: '48px' }}>
            Fully clear application history or clear specific monthly transactional records to free up space. This action is irreversible!
          </p>
          <button 
            onClick={() => setShowDeleteModal(true)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Warning/Modal Overlay for Deletion */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            width: '100%',
            maxWidth: '450px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }}>
            <div style={{ background: '#fef2f2', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <HiOutlineExclamationCircle style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }} />
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.25rem' }}>DANGER ZONE</h3>
              <p style={{ margin: '0.5rem 0 0 0', color: '#b91c1c', fontSize: '0.875rem' }}>
                You are about to permanently delete system data. This action cannot be undone. Please ensure you have backed up the data first.
              </p>
            </div>
            
            <form onSubmit={handleClearDataSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Deletion Type</label>
                <select 
                  value={deleteType} 
                  onChange={(e) => setDeleteType(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                >
                  <option value="full">Full Database Reset (Keep Core Settings)</option>
                  <option value="month">Clear Specific Month</option>
                </select>
              </div>

              {deleteType === 'month' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Select Month</label>
                  <input 
                    type="month" 
                    value={deleteMonth}
                    onChange={(e) => setDeleteMonth(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Admin Password</label>
                <input 
                  type="password" 
                  placeholder="Enter your password to verify"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowDeleteModal(false); setPassword(''); setDeleteMonth(''); }}
                  style={{ flex: 1, padding: '0.75rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isDeleting || !password}
                  style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: (!password || isDeleting) ? 'not-allowed' : 'pointer', opacity: (!password || isDeleting) ? 0.6 : 1 }}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
