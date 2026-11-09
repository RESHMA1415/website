import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DataTable, ErrorNote, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';
import { ORDER_STATUS, PAYMENT_STATUS, Pill } from '../orderLabels.jsx';

// Order list (PRD §14.7): tabs, filters, search, bulk Processing and packing slips
const TABS = [
  ['new', 'New'],
  ['processing', 'Processing'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
  ['returns', 'Returns & RTO'],
  ['all', 'All'],
];

export default function Orders() {
  const { notify } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('new');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ paymentMethod: '', paymentStatus: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const search = useDebounced(q);
  const params = new URLSearchParams({ tab, page, q: search, ...filters });
  const { data, loading, error, reload } = useApi(`/admin/orders?${params}`);
  const items = data?.items || [];

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };
  const switchTab = (key) => {
    setTab(key);
    setPage(1);
    setSelected([]);
  };
  const allChecked = items.length > 0 && items.every((o) => selected.includes(o.orderNumber));
  const toggle = (n) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const markProcessing = async () => {
    setBusy(true);
    try {
      const r = await api('/admin/orders/bulk/processing', { method: 'POST', body: { orderNumbers: selected } });
      notify(`${r.moved} order(s) marked Processing${r.skipped.length ? `; ${r.skipped.length} skipped (already further along)` : ''}`);
      setSelected([]);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const printSlips = (numbers) => navigate(`/orders/print?orders=${encodeURIComponent(numbers.join(','))}`);

  return (
    <>
      <PageTitle
        title="Orders"
        subtitle="Pack, ship and track every order"
        actions={
          <button type="button" className="btn btn-light" disabled={!items.length} onClick={() => printSlips(selected.length ? selected : items.map((o) => o.orderNumber))}>
            <i className="bi bi-printer me-1" />Print packing slips{selected.length ? ` (${selected.length})` : ''}
          </button>
        }
      />
      <div className="panel">
        <ul className="nav nav-tabs px-3 pt-2">
          {TABS.map(([key, label]) => (
            <li key={key} className="nav-item">
              <button type="button" className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => switchTab(key)}>
                {label}
                {data?.counts?.[key] > 0 && <span className="badge rounded-pill text-bg-light ms-1">{data.counts[key]}</span>}
              </button>
            </li>
          ))}
        </ul>
        <SearchBar placeholder="Search order number, customer, mobile or email" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Payment method" value={filters.paymentMethod} onChange={setFilter('paymentMethod')}>
            <option value="">All payments</option>
            <option value="online">Online</option>
            <option value="cod">Cash on Delivery</option>
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Payment status" value={filters.paymentStatus} onChange={setFilter('paymentStatus')}>
            <option value="">Any payment status</option>
            {Object.entries(PAYMENT_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="small text-muted d-flex align-items-center gap-1">From <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} value={filters.from} onChange={setFilter('from')} /></label>
          <label className="small text-muted d-flex align-items-center gap-1">To <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} value={filters.to} onChange={setFilter('to')} /></label>
        </SearchBar>
        {selected.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom" style={{ background: '#fff8f1' }}>
            <strong className="small">{selected.length} selected</strong>
            <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={markProcessing}>Mark Processing</button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => printSlips(selected)}><i className="bi bi-printer me-1" />Print packing slips</button>
            <button type="button" className="btn btn-sm btn-link" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        <div className="px-3"><ErrorNote error={error} /></div>
        <DataTable
          columns={[
            <input key="all" type="checkbox" className="form-check-input" aria-label="Select all" checked={allChecked} onChange={() => setSelected(allChecked ? [] : items.map((o) => o.orderNumber))} />,
            'Order', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', '',
          ]}
          rows={items}
          empty={loading ? 'Loading orders…' : 'No orders here.'}
          renderRow={(o) => (
            <tr key={o.orderNumber}>
              <td><input type="checkbox" className="form-check-input" aria-label={`Select ${o.orderNumber}`} checked={selected.includes(o.orderNumber)} onChange={() => toggle(o.orderNumber)} /></td>
              <td><Link to={`/orders/${o.orderNumber}`} className="fw-semibold text-nowrap">{o.orderNumber}</Link></td>
              <td className="small text-nowrap">{formatDateTime(o.createdAt)}</td>
              <td className="small">
                <div className="fw-semibold">{o.customer}</div>
                <div className="text-muted">{o.mobile}{o.city ? ` · ${o.city}` : ''}</div>
              </td>
              <td>{o.itemsCount}</td>
              <td className="fw-semibold">{formatINR(o.total)}</td>
              <td className="small">
                <div>{o.paymentMethod === 'cod' ? 'COD' : 'Online'}</div>
                <Pill map={PAYMENT_STATUS} value={o.paymentStatus} />
              </td>
              <td><Pill map={ORDER_STATUS} value={o.status} /></td>
              <td><Link to={`/orders/${o.orderNumber}`} className="btn btn-sm btn-light">Open</Link></td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="orders" />}
      </div>
    </>
  );
}
