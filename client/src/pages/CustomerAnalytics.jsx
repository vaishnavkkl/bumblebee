import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../components/Loaders';
import Pagination from '../components/Pagination';
import {
  HiOutlineUserGroup, HiOutlineTrendingUp, HiOutlineCurrencyRupee,
  HiOutlineFire, HiOutlineExclamation, HiOutlineX, HiOutlineStar,
  HiOutlineRefresh, HiOutlineChartBar
} from 'react-icons/hi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
const STATUS_COLORS = { Active: '#10b981', 'At Risk': '#f59e0b', Lost: '#ef4444' };
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

function KPICard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-info">
        <h4>{label}</h4>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginTop: 32, marginBottom: 16 }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
      {sub && <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  );
}

export default function CustomerAnalytics() {
  const [customers, setCustomers] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [frequency, setFrequency] = useState([]);
  const [services, setServices] = useState([]);
  const [workshopKpis, setWorkshopKpis] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [workshopTotal, setWorkshopTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tableRefresh, setTableRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  // Load KPIs, charts (one-time, small aggregates — no pagination needed)
  const loadCharts = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/analytics/customers/kpis'),
      api.get('/analytics/customers/trend'),
      api.get('/analytics/customers/top'),
      api.get('/analytics/customers/frequency'),
      api.get('/analytics/customers/services'),
      api.get('/analytics/customers/workshops/kpis'),
      api.get('/analytics/customers/workshops?limit=10'),
    ]).then(([k, t, top, f, s, wk, wl]) => {
      if (k.status === 'fulfilled') setKpis(k.value.data);
      if (t.status === 'fulfilled') setTrend(t.value.data);
      if (top.status === 'fulfilled') setTopCustomers(top.value.data);
      if (f.status === 'fulfilled') setFrequency(f.value.data);
      if (s.status === 'fulfilled') setServices(s.value.data);
      if (wk.status === 'fulfilled') setWorkshopKpis(wk.value.data);
      if (wl.status === 'fulfilled') {
        setWorkshops(wl.value.data.data || []);
        setWorkshopTotal(wl.value.data.total || 0);
      }
    }).finally(() => setLoading(false));
  };

  // Load paginated customer table
  useEffect(() => { loadCharts(); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setTableLoading(true);
    const params = new URLSearchParams({ page, limit, search: debouncedSearch, status: statusFilter });
    api.get(`/analytics/customers?${params}`, { signal: controller.signal })
      .then(r => {
        setCustomers(r.data.data);
        setTotal(r.data.total);
      })
      .catch(err => {
        if (err.code !== 'ERR_CANCELED') console.error('Failed to load customers', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTableLoading(false);
      });
    return () => controller.abort();
  }, [page, limit, debouncedSearch, statusFilter, tableRefresh]);

  const load = () => {
    loadCharts();
    setDebouncedSearch(search.trim());
    setTableRefresh(value => value + 1);
  };

  const getStatus = (lastVisit) => {
    const days = Math.floor((new Date() - new Date(lastVisit)) / 86400000);
    if (days <= 30) return { label: 'Active', days };
    if (days <= 90) return { label: 'At Risk', days };
    return { label: 'Lost', days };
  };

  const retentionRate = kpis
    ? Math.round((Number(kpis.repeat_customers) / Math.max(Number(kpis.total_tracked), 1)) * 100)
    : 0;

  // Pie chart data from KPIs
  const pieData = kpis ? [
    { name: 'Active', value: Number(kpis.active_customers) },
    { name: 'At Risk', value: Number(kpis.at_risk_customers) },
    { name: 'Lost', value: Number(kpis.lost_customers) },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="fade-in">
      <Toaster position="top-center" />
      <div className="page-header">
        <div>
          <h2>Customer Analytics</h2>
          <p>Retention, frequency & revenue intelligence</p>
        </div>
        <button className="btn btn-secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HiOutlineRefresh /> Refresh
        </button>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────── */}
      <div className="stats-grid">
        <KPICard icon={<HiOutlineUserGroup />} label="Total Tracked" color="blue"
          value={loading ? '…' : Number(kpis?.total_tracked || 0).toLocaleString()}
          sub="Customers with mobile numbers" />
        <KPICard icon={<HiOutlineTrendingUp />} label="Repeat Customers" color="green"
          value={loading ? '…' : Number(kpis?.repeat_customers || 0).toLocaleString()}
          sub={`${retentionRate}% retention rate`} />
        <KPICard icon={<HiOutlineCurrencyRupee />} label="Total Revenue" color="amber"
          value={loading ? '…' : `₹${Number(kpis?.total_revenue || 0).toLocaleString()}`}
          sub="From tracked customers" />
        <KPICard icon={<HiOutlineFire />} label="Active (≤30 days)" color="green"
          value={loading ? '…' : Number(kpis?.active_customers || 0).toLocaleString()}
          sub="Visited in last 30 days" />
        <KPICard icon={<HiOutlineExclamation />} label="At Risk (31–90 days)" color="amber"
          value={loading ? '…' : Number(kpis?.at_risk_customers || 0).toLocaleString()}
          sub="Need re-engagement" />
        <KPICard icon={<HiOutlineX />} label="Lost (>90 days)" color="red"
          value={loading ? '…' : Number(kpis?.lost_customers || 0).toLocaleString()}
          sub="Haven't visited in 90+ days" />
      </div>

      {/* ── CHARTS ROW ────────────────────────────────────── */}
      <SectionHeader title="Workshop Bulk Wash Analytics" sub="Workshop-origin bills, revenue, and recent activity" />
      <div className="stats-grid">
        <KPICard icon={<HiOutlineChartBar />} label="Tracked Workshops" color="blue"
          value={loading ? '...' : Number(workshopKpis?.total_workshops || 0).toLocaleString()}
          sub={`${workshopTotal} workshop records`} />
        <KPICard icon={<HiOutlineRefresh />} label="Repeat Workshops" color="green"
          value={loading ? '...' : Number(workshopKpis?.repeat_workshops || 0).toLocaleString()}
          sub="More than one bill" />
        <KPICard icon={<HiOutlineCurrencyRupee />} label="Workshop Revenue" color="amber"
          value={loading ? '...' : formatMoney(workshopKpis?.total_revenue)}
          sub="From workshop bills" />
        <KPICard icon={<HiOutlineFire />} label="Active Workshops" color="green"
          value={loading ? '...' : Number(workshopKpis?.active_workshops || 0).toLocaleString()}
          sub="Billed in last 30 days" />
      </div>

      <div className="table-container" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Workshop</th><th>Contact</th><th>Bills</th><th>Vehicles</th><th>Total Spent</th><th>Avg. Spend</th><th>Last Visit</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />) :
              workshops.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>No workshop bills yet.</td></tr>
              ) : workshops.map((w, i) => {
                const { label, days } = getStatus(w.last_visit);
                const badgeColor = label === 'Active' ? 'badge-green' : label === 'At Risk' ? 'badge-amber' : 'badge-red';
                return (
                  <tr key={w.workshop_id || i}>
                    <td>
                      <strong>{w.workshop_name}</strong>
                      {w.services_used && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{w.services_used}</span>}
                    </td>
                    <td>{w.contact_person || w.phone || '-'}</td>
                    <td>{w.bill_count}</td>
                    <td>{w.vehicle_count}</td>
                    <td>{formatMoney(w.total_spent)}</td>
                    <td>{formatMoney(w.avg_spend)}</td>
                    <td>
                      {new Date(w.last_visit).toLocaleDateString()}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {days === 0 ? 'Today' : `${days}d ago`}
                      </span>
                    </td>
                    <td><span className={`badge ${badgeColor}`}>{label}</span></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Trends & Segmentation" sub="Monthly visit volume and customer health breakdown" />
      <div className="grid-2">
        <div className="chart-container">
          <div className="chart-header"><h3>Monthly Visit & Revenue Trend</h3></div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickFormatter={v => `₹${v}`} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" name="Revenue" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" name="Visits" dataKey="total_bills" stroke="#10b981" fill="url(#visitGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No trend data yet</p></div>}
        </div>

        <div className="chart-container">
          <div className="chart-header"><h3>Customer Health Breakdown</h3></div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No customers tracked yet</p></div>}
        </div>
      </div>

      {/* ── FREQUENCY & SERVICES ROW ──────────────────────── */}
      <SectionHeader title="Engagement & Service Analysis" sub="How often customers visit and which services drive revenue" />
      <div className="grid-2">
        <div className="chart-container">
          <div className="chart-header"><h3>Visit Frequency Segments</h3></div>
          {frequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={frequency} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} />
                <YAxis dataKey="segment" type="category" width={100} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="customers" name="Customers" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No data yet</p></div>}
        </div>

        <div className="chart-container">
          <div className="chart-header"><h3>Top Services by Popularity</h3></div>
          {services.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={services.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }}
                  formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue_generated" name="Revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No service data yet</p></div>}
        </div>
      </div>

      {/* ── TOP 10 VIP CUSTOMERS ──────────────────────────── */}
      <SectionHeader title="VIP Customers — Top 10 by Revenue" sub="Your highest-value customers to prioritize and reward" />
      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Mobile</th><th>Total Visits</th><th>Total Spent</th><th>Last Visit</th><th>Loyalty Tier</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />) :
              topCustomers.map((c, i) => {
                const tier = c.visit_count >= 10 ? { label: '💎 Platinum', color: '#8b5cf6' }
                  : c.visit_count >= 5 ? { label: '🥇 Gold', color: '#f59e0b' }
                  : c.visit_count >= 2 ? { label: '🥈 Silver', color: '#6b7280' }
                  : { label: '🆕 New', color: '#3b82f6' };
                return (
                  <tr key={i}>
                    <td><strong>{i + 1}</strong></td>
                    <td><strong>{c.customer_mobile}</strong></td>
                    <td>{c.visit_count}</td>
                    <td>₹{Number(c.total_spent).toLocaleString()}</td>
                    <td>{new Date(c.last_visit).toLocaleDateString()}</td>
                    <td><span style={{ color: tier.color, fontWeight: 600, fontSize: '0.85rem' }}>{tier.label}</span></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ── FULL CUSTOMER TABLE ───────────────────────────── */}
      <SectionHeader title="All Tracked Customers" sub="Filter by status or search by mobile number" />
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          type="text" className="form-control" placeholder="🔍 Search by mobile…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 260 }}
        />
        {['All', 'Active', 'At Risk', 'Lost'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s}
          </button>
        ))}
        {!tableLoading && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{total} customers</span>}
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Mobile</th>
              <th>Visits</th>
              <th>Avg. Spend</th>
              <th>Total Spent</th>
              <th>Preferred</th>
              <th>First Visit</th>
              <th>Last Visit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />) :
              customers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>
                  {total === 0 ? 'No customer data yet. Start adding mobile numbers to bills.' : 'No customers match your filter.'}
                </td></tr>
              ) : customers.map((c, i) => {
                const { label, days } = getStatus(c.last_visit);
                const badgeColor = label === 'Active' ? 'badge-green' : label === 'At Risk' ? 'badge-amber' : 'badge-red';
                return (
                  <tr key={i}>
                    <td><strong>{c.customer_mobile}</strong></td>
                    <td>{c.visit_count}</td>
                    <td>₹{Number(c.avg_spend).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>₹{Number(c.total_spent).toLocaleString()}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.preferred_types || '—'}</td>
                    <td>{new Date(c.first_visit).toLocaleDateString()}</td>
                    <td>
                      {new Date(c.last_visit).toLocaleDateString()}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {days === 0 ? 'Today' : `${days}d ago`}
                      </span>
                    </td>
                    <td><span className={`badge ${badgeColor}`}>{label}</span></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
      </div>
    </div>
  );
}
