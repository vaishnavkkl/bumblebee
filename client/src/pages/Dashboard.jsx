import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import {
  BillIcon, PaymentHistoryIcon, CarWashStatusIcon, IncomeIcon, ExpenseIcon,
  TeamIcon, CalendarCheckIcon, HoursIcon, SalaryIcon, CustomerIcon,
  MoneyStackIcon, WashIcon, DashboardIcon,
} from '../components/CarWashIcons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { SkeletonCard, PageLoader } from '../components/Loaders';

const MODULES = [
  { label: 'New Bill',        icon: <BillIcon />,           path: '/billing/new',          light: '#1d4ed8', dark: '#3b82f6', desc: 'Create a wash bill' },
  { label: 'Payment History', icon: <PaymentHistoryIcon />, path: '/billing/history',       light: '#059669', dark: '#10b981', desc: 'View all transactions' },
  { label: 'Vehicle Status',  icon: <CarWashStatusIcon />,  path: '/vehicles/status',       light: '#b45309', dark: '#f59e0b', desc: 'Live wash queue' },
  { label: 'Income',          icon: <IncomeIcon />,         path: '/finance/income',        light: '#047857', dark: '#10b981', desc: 'Revenue records' },
  { label: 'Expenses',        icon: <ExpenseIcon />,        path: '/finance/expenses',      light: '#b91c1c', dark: '#ef4444', desc: 'Track spending' },
  { label: 'Employees',       icon: <TeamIcon />,           path: '/employees',             light: '#6d28d9', dark: '#8b5cf6', desc: 'Manage team' },
  { label: 'Attendance',      icon: <CalendarCheckIcon />,  path: '/employees/attendance',  light: '#1e40af', dark: '#60a5fa', desc: 'Daily check-in/out' },
  { label: 'Working Hours',   icon: <HoursIcon />,          path: '/employees/hours',       light: '#92400e', dark: '#fbbf24', desc: 'Hours summary' },
  { label: 'Salary',          icon: <SalaryIcon />,         path: '/employees/salary',      light: '#065f46', dark: '#34d399', desc: 'Payroll' },
  { label: 'Customers',       icon: <CustomerIcon />,       path: '/analytics/customers',   light: '#9d174d', dark: '#f472b6', desc: 'Retention analytics' },
];

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/summary')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader text="Loading dashboard..." />;
  if (!data) return null;

  const weeklyChart = [];
  const allDates = new Set([...data.weeklyIncome.map(i => i.date), ...data.weeklyExpenses.map(e => e.date)]);
  for (const date of [...allDates].sort()) {
    const inc = data.weeklyIncome.find(i => i.date === date);
    const exp = data.weeklyExpenses.find(e => e.date === date);
    weeklyChart.push({
      date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      income: inc ? Number(inc.total) : 0,
      expenses: exp ? Number(exp.total) : 0
    });
  }

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div><h2>Dashboard</h2><p>Today's overview at a glance</p></div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon amber"><MoneyStackIcon /></div>
          <div className="stat-info">
            <h4>Today's Income</h4>
            <div className="stat-value">₹{Number(data.todayIncome).toLocaleString()}</div>
            <div className="stat-sub">Cash: ₹{Number(data.totalInHand).toLocaleString()} · Online: ₹{Number(data.totalAccount).toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><ExpenseIcon /></div>
          <div className="stat-info"><h4>Today's Expenses</h4><div className="stat-value">₹{Number(data.todayExpenses).toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><WashIcon /></div>
          <div className="stat-info"><h4>Today's Bills</h4><div className="stat-value">{data.todayBills}</div><div className="stat-sub">{data.pendingWash} currently washing</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TeamIcon /></div>
          <div className="stat-info"><h4>Total Employees</h4><div className="stat-value">{data.totalEmployees}</div></div>
        </div>
      </div>

      {/* ── QUICK ACCESS MODULE CARDS ─────────────────── */}
      <div style={{ marginTop: 28, marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Quick Access</h3>
        <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>Navigate to any module instantly</p>
      </div>
      <div className="qa-grid">
        {MODULES.map(mod => (
          <div
            key={mod.path}
            className="qa-card"
            style={{ '--qa-light': mod.light, '--qa-dark': mod.dark }}
            onClick={() => navigate(mod.path)}
          >
            <div className="qa-icon-wrap">
              {mod.icon}
            </div>
            <div>
              <div className="qa-label">{mod.label}</div>
              <div className="qa-desc">{mod.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="chart-container">
          <div className="chart-header"><h3>Weekly Income vs Expenses</h3></div>
          {weeklyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weeklyChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `₹${val}`} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']}
                  labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                />
                <Area type="monotone" name="Income" dataKey="income" stroke="#10b981" fill="url(#incGrad)" strokeWidth={3} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" name="Expenses" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={3} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No data for this week</p></div>}
        </div>

        <div className="chart-container">
          <div className="chart-header"><h3>Vehicle Distribution Today</h3></div>
          {data.vehicleStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.vehicleStats} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={({ label, count }) => `${label}: ${count}`}>
                  {data.vehicleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No vehicles washed today</p></div>}
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: 8 }}>
        <div className="stat-card">
          <div className="stat-icon green"><IncomeIcon /></div>
          <div className="stat-info"><h4>Monthly Income</h4><div className="stat-value amount-green">₹{Number(data.monthlyIncome).toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><ExpenseIcon /></div>
          <div className="stat-info"><h4>Monthly Expenses</h4><div className="stat-value amount-red">₹{Number(data.monthlyExpenses).toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MoneyStackIcon /></div>
          <div className="stat-info">
            <h4>Monthly Profit</h4>
            <div className="stat-value" style={{ color: Number(data.monthlyIncome) - Number(data.monthlyExpenses) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              ₹{(Number(data.monthlyIncome) - Number(data.monthlyExpenses)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
