import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  DashboardIcon, BillIcon, PaymentHistoryIcon, CarWashStatusIcon,
  IncomeIcon, ExpenseIcon, PendingIcon, TeamIcon, CalendarCheckIcon,
  HoursIcon, SalaryIcon, CustomerIcon, SecurityIcon, MaintenanceIcon,
} from './CarWashIcons';

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'nav-item active' : 'nav-item';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img className="brand-logo" src="/assets/logo.svg" alt="Bumblebee" />
        <div>
          <h1>Bumblebee</h1>
          <span>Car Wash Pro</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <NavLink to="/" end className={isActive('/')}>
            <span className="nav-icon"><DashboardIcon /></span> Dashboard
          </NavLink>
        </div>

        {isAdmin && (
          <div className="nav-section">
            <div className="nav-section-title">Analytics</div>
            <NavLink to="/analytics/customers" className={isActive('/analytics/customers')}>
              <span className="nav-icon"><CustomerIcon /></span> Customers
            </NavLink>
          </div>
        )}

        <div className="nav-section">
          <div className="nav-section-title">Billing</div>
          <NavLink to="/billing/new" className={isActive('/billing/new')}>
            <span className="nav-icon"><BillIcon /></span> New Bill
          </NavLink>
          <NavLink to="/billing/history" className={isActive('/billing/history')}>
            <span className="nav-icon"><PaymentHistoryIcon /></span> Payment History
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Vehicles</div>
          <NavLink to="/vehicles/status" className={isActive('/vehicles/status')}>
            <span className="nav-icon"><CarWashStatusIcon /></span> Wash Status
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          {isAdmin && (
            <NavLink to="/finance/income" className={isActive('/finance/income')}>
              <span className="nav-icon"><IncomeIcon /></span> Income
            </NavLink>
          )}
          <NavLink to="/finance/expenses" className={isActive('/finance/expenses')}>
            <span className="nav-icon"><ExpenseIcon /></span> Expenses
          </NavLink>
          <NavLink to="/finance/pending" className={isActive('/finance/pending')}>
            <span className="nav-icon"><PendingIcon /></span> Pending
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Employees</div>
          {isAdmin && (
            <NavLink to="/employees" end className={isActive('/employees')}>
              <span className="nav-icon"><TeamIcon /></span> Manage
            </NavLink>
          )}
          <NavLink to="/employees/attendance" className={isActive('/employees/attendance')}>
            <span className="nav-icon"><CalendarCheckIcon /></span> Attendance
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/employees/hours" className={isActive('/employees/hours')}>
                <span className="nav-icon"><HoursIcon /></span> Working Hours
              </NavLink>
              <NavLink to="/employees/salary" className={isActive('/employees/salary')}>
                <span className="nav-icon"><SalaryIcon /></span> Salary
              </NavLink>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="nav-section">
            <div className="nav-section-title">System</div>
            <NavLink to="/admin/services" className={isActive('/admin/services')}>
              <span className="nav-icon"><MaintenanceIcon /></span> Services
            </NavLink>
            <NavLink to="/admin/workshops" className={isActive('/admin/workshops')}>
              <span className="nav-icon"><CustomerIcon /></span> Workshops
            </NavLink>
            <NavLink to="/admin/security" className={isActive('/admin/security')}>
              <span className="nav-icon"><SecurityIcon /></span> Security & Data
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}
