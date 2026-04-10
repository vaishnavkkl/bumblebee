import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HiOutlineSun, HiOutlineMoon, HiOutlineLogout, HiOutlineChevronLeft, HiOutlineMenu } from 'react-icons/hi';

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
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnDashboard = location.pathname === '/';

  return (
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
        <div className="header-user">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <span>{user?.name}</span>
          <span className="badge badge-amber" style={{ marginLeft: 4 }}>{user?.role}</span>
        </div>
        <button className="btn-icon" onClick={logout} title="Logout">
          <HiOutlineLogout />
        </button>
      </div>
    </header>
  );
}
