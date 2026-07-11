import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { PageLoader } from './components/Loaders';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const NewBill = lazy(() => import('./pages/NewBill'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const VehicleStatus = lazy(() => import('./pages/VehicleStatus'));
const Income = lazy(() => import('./pages/Income'));
const Expenses = lazy(() => import('./pages/Expenses'));
const EmployeeList = lazy(() => import('./pages/EmployeeList'));
const Attendance = lazy(() => import('./pages/Attendance'));
const WorkingHours = lazy(() => import('./pages/WorkingHours'));
const Salary = lazy(() => import('./pages/Salary'));
const CustomerAnalytics = lazy(() => import('./pages/CustomerAnalytics'));
const SecurityData = lazy(() => import('./pages/SecurityData'));
const PendingPayments = lazy(() => import('./pages/PendingPayments'));
const ServiceCatalog = lazy(() => import('./pages/ServiceCatalog'));
const WorkshopManagement = lazy(() => import('./pages/WorkshopManagement'));

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageLoader text="Loading session..." />;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageLoader text="Loading session..." />;

  return (
    <Suspense fallback={<PageLoader text="Loading page..." />}>
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
        <Route path="admin/services" element={<ProtectedRoute adminOnly><ServiceCatalog /></ProtectedRoute>} />
        <Route path="admin/workshops" element={<ProtectedRoute adminOnly><WorkshopManagement /></ProtectedRoute>} />
        <Route path="admin/security" element={<ProtectedRoute adminOnly><SecurityData /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
