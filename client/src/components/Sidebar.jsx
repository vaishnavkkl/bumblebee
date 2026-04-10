import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiOutlineHome, HiOutlineDocumentText, HiOutlineClock, HiOutlineCurrencyRupee, HiOutlineUserGroup, HiOutlineTruck, HiOutlineClipboardList, HiOutlineChartBar, HiOutlineCash, HiOutlineCalendar } from 'react-icons/hi';

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'nav-item active' : 'nav-item';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">B</div>
        <div>
          <h1>Bumblebee</h1>
          <span>Car Wash Pro</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {isAdmin && (
          <div className="nav-section">
            <div className="nav-section-title">Overview</div>
            <NavLink to="/" className={isActive('/')}>
              <span className="nav-icon"><HiOutlineHome /></span> Dashboard
            </NavLink>
          </div>
        )}

        {isAdmin && (
          <div className="nav-section">
            <div className="nav-section-title">Analytics</div>
            <NavLink to="/analytics/customers" className={isActive('/analytics/customers')}>
              <span className="nav-icon"><HiOutlineChartBar /></span> Customers
            </NavLink>
          </div>
        )}

        <div className="nav-section">
          <div className="nav-section-title">Billing</div>
          <NavLink to="/billing/new" className={isActive('/billing/new')}>
            <span className="nav-icon"><HiOutlineDocumentText /></span> New Bill
          </NavLink>
          <NavLink to="/billing/history" className={isActive('/billing/history')}>
            <span className="nav-icon"><HiOutlineClipboardList /></span> Payment History
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Vehicles</div>
          <NavLink to="/vehicles/status" className={isActive('/vehicles/status')}>
            <span className="nav-icon"><HiOutlineTruck /></span> Wash Status
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          {isAdmin && (
            <NavLink to="/finance/income" className={isActive('/finance/income')}>
              <span className="nav-icon"><HiOutlineCurrencyRupee /></span> Income
            </NavLink>
          )}
          <NavLink to="/finance/expenses" className={isActive('/finance/expenses')}>
            <span className="nav-icon"><HiOutlineCash /></span> Expenses
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Employees</div>
          {isAdmin && (
            <NavLink to="/employees" className={isActive('/employees')}>
              <span className="nav-icon"><HiOutlineUserGroup /></span> Manage
            </NavLink>
          )}
          <NavLink to="/employees/attendance" className={isActive('/employees/attendance')}>
            <span className="nav-icon"><HiOutlineCalendar /></span> Attendance
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/employees/hours" className={isActive('/employees/hours')}>
                <span className="nav-icon"><HiOutlineClock /></span> Working Hours
              </NavLink>
              <NavLink to="/employees/salary" className={isActive('/employees/salary')}>
                <span className="nav-icon"><HiOutlineChartBar /></span> Salary
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}
