import React from 'react';

export default function Pagination({ page, total, limit, onPageChange, onLimitChange }) {
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '10px 0', borderTop: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Show:</span>
        <select 
          className="form-control" 
          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
          value={limit}
          onChange={e => {
            onLimitChange(Number(e.target.value));
            onPageChange(1);
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.85rem' }} 
          disabled={page <= 1} 
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <span style={{ fontSize: '0.85rem', padding: '0 8px', fontWeight: 'bold' }}>
          Page {page} of {pages}
        </span>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.85rem' }} 
          disabled={page >= pages} 
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
