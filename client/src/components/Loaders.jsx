/* Full-screen page loader */
export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="page-loader">
      <div className="loader-content">
        <div className="loader-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring" style={{ animationDelay: '-0.3s' }} />
          <div className="spinner-ring" style={{ animationDelay: '-0.6s' }} />
        </div>
        <p className="loader-text">{text}</p>
      </div>
    </div>
  );
}

/* Inline row skeleton */
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: 14, borderRadius: 6, width: `${62 + (i * 11) % 29}%` }} />
        </td>
      ))}
    </tr>
  );
}

/* Card skeleton */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 11, width: '55%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 22, width: '70%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '45%' }} />
      </div>
    </div>
  );
}

/* Inline spinner for buttons */
export function Spinner({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block' }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

/* Small dot loader for table cells */
export function DotLoader() {
  return (
    <div className="dot-loader">
      <span /><span /><span />
    </div>
  );
}
