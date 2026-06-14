import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import NewBill from './pages/NewBill';
import PaymentHistory from './pages/PaymentHistory';
import VehicleStatus from './pages/VehicleStatus';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import EmployeeList from './pages/EmployeeList';
import Attendance from './pages/Attendance';
import WorkingHours from './pages/WorkingHours';
import Salary from './pages/Salary';
import CustomerAnalytics from './pages/CustomerAnalytics';
import SecurityData from './pages/SecurityData';
import PendingPayments from './pages/PendingPayments';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={isAdmin ? <Dashboard /> : <EmployeeDashboard />} />
        <Route path="billing/new" element={<NewBill />} />
        <Route path="billing/history" element={<PaymentHistory />} />
        <Route path="vehicles/status" element={<VehicleStatus />} />
        <Route path="finance/income" element={<ProtectedRoute adminOnly><Income /></ProtectedRoute>} />
        <Route path="finance/expenses" element={<Expenses />} />
        <Route path="finance/pending" element={<PendingPayments />} />
        <Route path="employees" element={<ProtectedRoute adminOnly><EmployeeList /></ProtectedRoute>} />
        <Route path="employees/attendance" element={<Attendance />} />
        <Route path="employees/hours" element={<ProtectedRoute adminOnly><WorkingHours /></ProtectedRoute>} />
        <Route path="employees/salary" element={<ProtectedRoute adminOnly><Salary /></ProtectedRoute>} />
        <Route path="analytics/customers" element={<ProtectedRoute adminOnly><CustomerAnalytics /></ProtectedRoute>} />
        <Route path="admin/security" element={<ProtectedRoute adminOnly><SecurityData /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
