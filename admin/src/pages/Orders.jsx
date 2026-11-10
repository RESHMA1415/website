import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';
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

const SHIPPABLE = ['confirmed', 'processing'];

// Ship several orders together: one courier box for all, a tracking number per order
function BulkShipModal({ orders, onClose, onDone }) {
  const { notify } = useAuth();
  const ready = orders.filter((o) => SHIPPABLE.includes(o.status));
  const notReady = orders.filter((o) => !SHIPPABLE.includes(o.status));
  const [courierForAll, setCourierForAll] = useState('');
  const [rows, setRows] = useState(() => Object.fromEntries(ready.map((o) => [o.orderNumber, { courier: '', trackingNumber: '', trackingUrl: '' }])));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (n, key, value) => setRows((r) => ({ ...r, [n]: { ...r[n], [key]: value } }));
  const applyCourier = (value) => {
    setCourierForAll(value);
    // Fills every courier box the admin hasn't typed into separately
    setRows((r) => Object.fromEntries(Object.entries(r).map(([n, row]) => [n, { ...row, courier: !row.courier || row.courier === courierForAll ? value : row.courier }])));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const shipments = Object.entries(rows).map(([orderNumber, row]) => ({ orderNumber, ...row }));
      const r = await api('/admin/orders/bulk/shipped', { method: 'POST', body: { shipments } });
      setResult(r);
      if (r.shipped.length) notify(`${r.shipped.length} order(s) marked Shipped. Customers are notified.`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Mark ${ready.length} order(s) as Shipped`}
      onClose={onClose}
      size="xl"
      footer={
        result ? (
          <button type="button" className="btn btn-orange" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
            <button type="submit" form="bulk-ship" className="btn btn-orange" disabled={busy || !ready.length}>{busy ? 'Saving…' : `Mark ${ready.length} Shipped`}</button>
          </>
        )
      }
    >
      {result ? (
        <div className="small">
          <p className="mb-2"><strong>{result.shipped.length}</strong> order(s) marked Shipped{result.shipped.length ? `: ${result.shipped.join(', ')}` : ''}.</p>
          {result.skipped.length > 0 && (
            <div className="alert alert-warning py-2">
              <div className="fw-semibold mb-1">Not shipped:</div>
              <ul className="mb-0 ps-3">{result.skipped.map((s) => <li key={s.orderNumber}>{s.orderNumber}: {s.reason}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <form id="bulk-ship" onSubmit={submit}>
          <ErrorNote error={error} />
          {notReady.length > 0 && (
            <div className="alert alert-light small py-2">
              Left out (only New or Processing orders can be shipped): {notReady.map((o) => `${o.orderNumber} (${ORDER_STATUS[o.status]?.[0] || o.status})`).join(', ')}
            </div>
          )}
          <div className="mb-3" style={{ maxWidth: 360 }}>
            <label className="form-label" htmlFor="bulk-courier">Courier for all orders</label>
            <input id="bulk-courier" className="form-control" maxLength={60} placeholder="e.g. Delhivery" value={courierForAll} onChange={(e) => applyCourier(e.target.value)} />
            <div className="form-text">You can still change it for a single order below.</div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Order</th><th>Customer</th><th>Courier *</th><th>Tracking number *</th><th>Tracking link</th></tr></thead>
              <tbody>
                {ready.map((o) => (
                  <tr key={o.orderNumber}>
                    <td className="small fw-semibold text-nowrap">{o.orderNumber}</td>
                    <td className="small">{o.customer}<div className="text-muted">{o.city}</div></td>
                    <td><input className="form-control form-control-sm" required maxLength={60} aria-label={`Courier for ${o.orderNumber}`} value={rows[o.orderNumber].courier} onChange={(e) => set(o.orderNumber, 'courier', e.target.value)} /></td>
                    <td><input className="form-control form-control-sm" required maxLength={60} aria-label={`Tracking number for ${o.orderNumber}`} value={rows[o.orderNumber].trackingNumber} onChange={(e) => set(o.orderNumber, 'trackingNumber', e.target.value)} /></td>
                    <td><input className="form-control form-control-sm" type="url" placeholder="https://…" aria-label={`Tracking link for ${o.orderNumber}`} value={rows[o.orderNumber].trackingUrl} onChange={(e) => set(o.orderNumber, 'trackingUrl', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Orders() {
  const { notify } = useAuth();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.some(([k]) => k === urlParams.get('tab')) ? urlParams.get('tab') : 'new'));
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ paymentMethod: '', paymentStatus: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [shipping, setShipping] = useState(null); // orders in the bulk-ship window
  const [known, setKnown] = useState({}); // details of ticked orders, kept across pages
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
  const remember = (list) => setKnown((k) => ({ ...k, ...Object.fromEntries(list.map((o) => [o.orderNumber, o])) }));
  const toggle = (n) => {
    remember(items.filter((o) => o.orderNumber === n));
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  };

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
            <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={() => setShipping(selected.map((n) => known[n] || { orderNumber: n, status: 'unknown' }))}><i className="bi bi-truck me-1" />Mark Shipped</button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => printSlips(selected)}><i className="bi bi-printer me-1" />Print packing slips</button>
            <button type="button" className="btn btn-sm btn-link" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        <div className="px-3"><ErrorNote error={error} /></div>
        <DataTable
          columns={[
            <input key="all" type="checkbox" className="form-check-input" aria-label="Select all" checked={allChecked} onChange={() => { remember(items); setSelected(allChecked ? [] : items.map((o) => o.orderNumber)); }} />,
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
      {shipping && (
        <BulkShipModal
          orders={shipping}
          onClose={() => setShipping(null)}
          onDone={() => { setSelected([]); reload(); }}
        />
      )}
    </>
  );
}
