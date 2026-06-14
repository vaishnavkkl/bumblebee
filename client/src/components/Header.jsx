import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HiOutlineSun, HiOutlineMoon, HiOutlineLogout, HiOutlineChevronLeft, HiOutlineMenu } from 'react-icons/hi';
import api from '../utils/api';
import toast from 'react-hot-toast';

const titles = {
  '/': 'Dashboard',
  '/billing/new': 'New Bill',
  '/billing/history': 'Payment History',
  '/vehicles/status': 'Wash Status',
  '/finance/income': 'Income Tracking',
  '/finance/expenses': 'Expense Tracking',
  '/employees': 'Employees',
  '/employees/attendance': 'Attendance',
  '/employees/hours': 'Working Hours',
  '/employees/salary': 'Salary Management',
  '/analytics/customers': 'Customer Analytics',
};

export default function Header({ onToggleSidebar, sidebarOpen }) {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const isOnDashboard = location.pathname === '/';

  const openProfile = () => {
    setProfileForm({ name: user?.name || '', phone: user?.phone || '', password: '' });
    setShowProfileModal(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await api.put('/auth/profile', profileForm);
      updateUser(res.data.token, res.data.user);
      toast.success(res.data.message || 'Profile updated!');
      setShowProfileModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          {/* Sidebar toggle */}
          <button
            className="btn-icon sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide navigation' : 'Show navigation'}
          >
            <HiOutlineMenu />
          </button>

          {/* Back to dashboard — shown on any non-dashboard page */}
          {!isOnDashboard && (
            <button
              className="btn-back"
              onClick={() => navigate('/')}
              title="Back to Dashboard"
            >
              <HiOutlineChevronLeft />
              Dashboard
            </button>
          )}

          <h2>{titles[location.pathname] || 'Bumblebee'}</h2>
        </div>

        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
          </button>
          <div className="header-user" onClick={openProfile} style={{ cursor: 'pointer' }} title="Update Profile">
            <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <span>{user?.name}</span>
            <span className="badge badge-amber" style={{ marginLeft: 4 }}>{user?.role}</span>
          </div>
          <button className="btn-icon" onClick={logout} title="Logout">
            <HiOutlineLogout />
          </button>
        </div>
      </header>

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Update Profile</h3></div>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" className="form-control" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" className="form-control" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>New Password (Optional)</label>
                <input type="password" className="form-control" placeholder="Leave blank to keep current password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isUpdating}>{isUpdating ? 'Updating...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
