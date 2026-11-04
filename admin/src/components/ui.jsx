import { useEffect, useState } from 'react';

// Small shared building blocks for admin screens

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <h1 className="h4 mb-1">{title}</h1>
        {subtitle && <p className="text-muted mb-0 small">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PhaseNotice({ phase, children }) {
  return (
    <div className="alert d-flex gap-2 align-items-start small mb-4" style={{ background: '#fff6ee', border: '1px solid #ffd7b0' }}>
      <i className="bi bi-tools text-orange" />
      <div>
        <strong>Preview (Phase {phase}):</strong> {children}
      </div>
    </div>
  );
}

export function StatCard({ icon, label, value, tone = 'navy' }) {
  const tones = {
    navy: { bg: '#eef1f8', color: '#14213d' },
    orange: { bg: '#fff3e8', color: '#ff7a00' },
    green: { bg: '#e8f6ee', color: '#198754' },
    red: { bg: '#fdecec', color: '#dc3545' },
  };
  const t = tones[tone];
  return (
    <div className="stat-card">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="label mb-1">{label}</div>
          <div className="value">{value}</div>
        </div>
        <div className="icon" style={{ background: t.bg, color: t.color }}>
          <i className={`bi ${icon}`} />
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, bodyClass = 'panel-body' }) {
  return (
    <div className="panel h-100">
      {(title || actions) && (
        <div className="panel-header">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

// Table with headings and a friendly empty message
export function DataTable({ columns, rows = [], empty = 'Nothing here yet.', renderRow }) {
  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            {columns.map((c, i) => <th key={i}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(renderRow)
          ) : (
            <tr>
              <td colSpan={columns.length} className="text-center text-muted py-5">
                <i className="bi bi-inbox fs-3 d-block mb-2" />
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <ul className="nav nav-tabs px-3 pt-2">
      {tabs.map((tab) => (
        <li key={tab} className="nav-item">
          <button type="button" className={`nav-link ${active === tab ? 'active' : ''}`} onClick={() => onChange(tab)}>
            {tab}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Pass `value` and `onChange` to make the search box work; without them it is a preview
export function SearchBar({ placeholder, value, onChange, children }) {
  const controlled = onChange ? { value, onChange: (e) => onChange(e.target.value) } : {};
  return (
    <div className="d-flex flex-wrap gap-2 p-3 border-bottom align-items-center">
      <div className="position-relative flex-grow-1" style={{ minWidth: 200, maxWidth: 360 }}>
        <i className="bi bi-search position-absolute text-muted" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="search" className="form-control form-control-sm ps-5" placeholder={placeholder} aria-label={placeholder} {...controlled} />
      </div>
      {children}
    </div>
  );
}

// Waits until typing pauses before searching
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function Pagination({ page, pages, total, onChange, label = 'items' }) {
  if (!pages || pages < 2) {
    return total ? <div className="small text-muted p-3">{total} {label}</div> : null;
  }
  const shown = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
      <div className="small text-muted">{total} {label} · page {page} of {pages}</div>
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page - 1)} aria-label="Previous page">‹</button>
        </li>
        {shown.map((n, i) => (
          <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
            {i > 0 && n - shown[i - 1] > 1 && <span className="page-link border-0 bg-transparent">…</span>}
            <button type="button" className="page-link" onClick={() => onChange(n)}>{n}</button>
          </li>
        ))}
        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page + 1)} aria-label="Next page">›</button>
        </li>
      </ul>
    </div>
  );
}

const STATUS_STYLES = {
  active: ['status-active', 'Active'],
  draft: ['status-draft', 'Draft'],
  hidden: ['status-hidden', 'Hidden'],
};

export function StatusPill({ status, label }) {
  const [className, text] = STATUS_STYLES[status] || ['status-draft', status];
  return <span className={`status-pill ${className}`}>{label || text}</span>;
}

export function StockPill({ stock, level = 5 }) {
  if (stock === 0) return <span className="status-pill status-hidden">Out of stock</span>;
  if (stock <= level) return <span className="status-pill status-low">Low · {stock} left</span>;
  return <span className="status-pill status-active">In stock</span>;
}

// Pop-up window. Closes with Esc or the × button.
export function Modal({ title, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`admin-modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-header">
          <h2>{title}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="alert alert-danger small py-2 mb-3" role="alert">{error.message || error}</div>;
}
