/**
 * CarWashIcons — Premium SVG icon set aligned to Car Wash & Service Center operations.
 * All icons are stroke-based, consistent weight (strokeWidth 1.5), and designed at 24×24.
 */

// 🚿 Wash / Spray nozzle — Wash Status, New Bill context
export const WashIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a8 8 0 0 1 16 0" />
    <path d="M12 6V3" />
    <path d="M6.34 8.34 4.22 6.22" />
    <path d="M17.66 8.34l2.12-2.12" />
    <circle cx="12" cy="17" r="3" />
    <path d="M12 20v2" />
    <path d="M9 17H7" />
    <path d="M17 17h-2" />
  </svg>
);

// 🧾 Receipt with spark — New Bill / Billing
export const BillIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V6a4 4 0 0 0-4-4z" />
    <path d="M8 10h8M8 14h5" />
    <path d="M19 2v4l2-1-2-1" />
  </svg>
);

// 📊 Rising graph with checkmark — Income
export const IncomeIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
    <circle cx="6" cy="20" r="1.5" />
    <path d="M6 18v-3" />
  </svg>
);

// 💸 Falling coin with arrow — Expenses
export const ExpenseIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M12 13v8" />
    <path d="M9 18l3 3 3-3" />
    <path d="M10 7h4M12 5v4" />
  </svg>
);

// 🚗 Car with water drops — Vehicle Wash Status
export const CarWashStatusIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2v-3l2-5h14l2 5v3a2 2 0 0 1-2 2h-2" />
    <circle cx="7.5" cy="17.5" r="2.5" />
    <circle cx="16.5" cy="17.5" r="2.5" />
    <path d="M17 4v3M20 5l-2 2M14 5l2 2" />
  </svg>
);

// 👥 Two people with a gear — Employee Manage
export const TeamIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M22 21v-1.5a3 3 0 0 0-3-3h-1" />
  </svg>
);

// ⏰ Clock with check — Attendance
export const AttendanceIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
    <path d="M8.5 17.5l2 2 3.5-4" />
  </svg>
);

// ⏱ Hourglass — Working Hours
export const HoursIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3h14M5 21h14" />
    <path d="M5 3c0 7 7 9 7 9s7-2 7-9" />
    <path d="M5 21c0-7 7-9 7-9s7 2 7 9" />
    <path d="M9 16h6" />
  </svg>
);

// 💰 Wallet with rupee — Salary / Payroll
export const SalaryIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M10 12h4M12 10v4" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

// 📈 Customer analytics — Retention curve
export const CustomerIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="M16 11l2 2 4-4" />
  </svg>
);

// ⏳ Pending payment — hourglass with rupee
export const PendingIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12" />
    <path d="M6 22h12" />
    <path d="M6 2c0 6 6 8 6 10S6 16 6 22" />
    <path d="M18 2c0 6-6 8-6 10s6 4 6 10" />
    <path d="M10 14h4M12 12v4" />
  </svg>
);

// 🏠 Dashboard / Home with speedometer
export const DashboardIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12L12 3l9 9" />
    <path d="M9 21V12h6v9" />
    <path d="M3 21h18" />
    <circle cx="12" cy="15" r="1" />
  </svg>
);

// 🛡 Shield with lock — Security & Data
export const SecurityIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="5" rx="1" />
    <path d="M12 11v-2a2 2 0 0 1 2-2" />
  </svg>
);

// 💳 Payment history — card with check
export const PaymentHistoryIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M7 15h3M14 15l1.5 1.5L18 13" />
  </svg>
);

// ₹ Today's income — coin stack
export const MoneyStackIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
    <path d="M11 6h2M12 4v4" />
  </svg>
);

// 🔧 Tools / Wrench — Maintenance / Operational
export const MaintenanceIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z" />
  </svg>
);

// 📅 Calendar with checkmark — Attendance variant
export const CalendarCheckIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M9 16l2 2 4-4" />
  </svg>
);
