import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Pagination, SearchBar, StockPill, useDebounced } from '../components/ui.jsx';

const REASON_LABELS = {
  order: 'Order', cancellation: 'Cancellation', return: 'Return', exchange: 'Exchange', rto: 'Returned by courier',
  new_stock: 'New stock', damaged: 'Damaged', correction: 'Correction',
};
const MANUAL = ['new_stock', 'damaged', 'correction'];

function StockEditor({ row, onSaved }) {
  const { notify } = useAuth();
  const [stock, setStock] = useState(row.stock);
  const [reason, setReason] = useState('new_stock');
  const [saving, setSaving] = useState(false);
  const changed = String(stock) !== String(row.stock) && stock !== '';
  const diff = Number(stock) - row.stock;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api(`/admin/inventory/${row.productId}/${row.variantId}`, { method: 'PATCH', body: { stock: Number(stock), stockLoaded: row.stock, reason } });
      // The server applies only this change on top of live stock, so the result can differ if something sold meanwhile
      notify(`${row.productName} (${row.optionLabel}): stock is now ${saved.stock}`);
      onSaved();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex gap-1 align-items-center">
      <input
        type="number"
        min="0"
        className="form-control form-control-sm"
        style={{ width: 80 }}
        value={stock}
        onChange={(e) => {
          const value = e.target.value;
          setStock(value);
          setReason(Number(value) > row.stock ? 'new_stock' : 'correction');
        }}
        onKeyDown={(e) => e.key === 'Enter' && changed && save()}
        aria-label={`Stock for ${row.sku}`}
      />
      {changed && (
        <>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
            {MANUAL.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
          <button type="button" className="btn btn-sm btn-orange text-nowrap" disabled={saving} onClick={save}>
            Save ({diff > 0 ? '+' : ''}{diff})
          </button>
        </>
      )}
    </div>
  );
}

function HistoryModal({ row, onClose }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi(`/admin/inventory/${row.productId}/${row.variantId}/history?page=${page}`);
  return (
    <Modal title={`Stock history: ${row.productName} (${row.optionLabel})`} onClose={onClose} size="lg">
      <div className="small text-muted mb-2">SKU {row.sku} · current stock {row.stock}</div>
      <DataTable
        columns={['Date', 'Change', 'Stock after', 'Reason', 'Order / note']}
        rows={data?.items || []}
        empty={loading ? 'Loading…' : 'No stock changes recorded yet.'}
        renderRow={(m) => (
          <tr key={m._id}>
            <td className="small text-nowrap">{formatDateTime(m.at)}</td>
            <td className={`fw-semibold ${m.change > 0 ? 'text-success' : 'text-danger'}`}>{m.change > 0 ? `+${m.change}` : m.change}</td>
            <td>{m.stockAfter ?? '–'}</td>
            <td className="small">{REASON_LABELS[m.reason] || m.reason}</td>
            <td className="small text-muted">{[m.orderNumber, m.note].filter(Boolean).join(' · ')}</td>
          </tr>
        )}
      />
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="changes" />}
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [reason, setReason] = useState('new_stock');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      const r = await api(`/admin/inventory/import?reason=${reason}`, { method: 'POST', body: text, headers: { 'Content-Type': 'text/csv' } });
      setResult(r);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Bulk update stock (CSV)"
      onClose={onClose}
      footer={
        result ? (
          <button type="button" className="btn btn-orange" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-orange" disabled={!file || busy} onClick={submit}>{busy ? 'Updating…' : 'Upload & update'}</button>
          </>
        )
      }
    >
      {result ? (
        <>
          <div className="alert alert-success small">
            <strong>{result.updated}</strong> option{result.updated === 1 ? '' : 's'} updated · {result.unchanged} unchanged
          </div>
          {result.errorCount > 0 && (
            <div className="alert alert-warning small mb-0">
              <strong>{result.errorCount} row{result.errorCount === 1 ? '' : 's'} skipped:</strong>
              <ul className="mb-0 mt-1">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </>
      ) : (
        <>
          <ol className="small ps-3">
            <li>Click <strong>Export</strong> to download your current stock as a spreadsheet.</li>
            <li>Open it in Excel or Google Sheets and change only the <strong>Stock</strong> (and, if you like, <strong>Low-stock level</strong>) column. Don’t change the SKU or the “Stock when downloaded” column: it lets us keep any sales made after you downloaded the sheet.</li>
            <li>Save as <strong>CSV</strong> and upload it here.</li>
          </ol>
          <ErrorNote error={error} />
          <div className="mb-3">
            <input ref={input} type="file" accept=".csv,text/csv" className="form-control" onChange={(e) => setFile(e.target.files[0] || null)} aria-label="CSV file" />
          </div>
          <label className="form-label" htmlFor="imp-reason">Reason for these changes</label>
          <select id="imp-reason" className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {MANUAL.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
        </>
      )}
    </Modal>
  );
}

export default function Inventory() {
  const { notify } = useAuth();
  const [urlParams] = useSearchParams();
  const [q, setQ] = useState(() => urlParams.get('q') || '');
  const search = useDebounced(q);
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [importing, setImporting] = useState(false);

  const query = new URLSearchParams({ page: String(page), q: search, stock, category });
  const { data, loading, reload } = useApi(`/admin/inventory?${query}`);
  const { data: counts, reload: reloadCounts } = useApi('/admin/inventory/counts');
  // Pickers need every category; 200 top levels is the server's page cap
  const { data: categoryPage } = useApi('/admin/categories?limit=200');
  const categories = categoryPage?.items;
  const refresh = () => {
    reload();
    reloadCounts();
  };
  const filters = [
    ['', `All (${counts?.total ?? '…'})`],
    ['low', `Low stock (${counts?.low ?? '…'})`],
    ['out', `Out of stock (${counts?.out ?? '…'})`],
  ];

  return (
    <>
      <PageTitle
        title="Inventory"
        subtitle="Stock for every size and colour combination"
        actions={
          <>
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => downloadFile(`/admin/inventory/export?${new URLSearchParams({ q: search, stock, category })}`, 'shopme-inventory.csv').catch((err) => notify(err.message, 'error'))}
            >
              <i className="bi bi-download me-1" />Export (Excel/CSV)
            </button>
            <button type="button" className="btn btn-navy" onClick={() => setImporting(true)}>
              <i className="bi bi-upload me-1" />Bulk update (CSV)
            </button>
          </>
        }
      />
      <div className="panel">
        <SearchBar placeholder="Search by product, brand or SKU" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
          <div className="btn-group btn-group-sm">
            {filters.map(([key, label]) => (
              <button key={key} type="button" className={`btn ${stock === key ? 'btn-navy' : 'btn-outline-secondary'}`} onClick={() => { setStock(key); setPage(1); }}>
                {label}
              </button>
            ))}
          </div>
          <CategorySelect tree={categories} value={category} onChange={(v) => { setCategory(v); setPage(1); }} allLabel="All categories" className="form-select form-select-sm w-auto" />
        </SearchBar>
        <DataTable
          columns={['', 'Product', 'Option', 'SKU', 'Price', 'Stock', 'Status', '']}
          rows={data?.items || []}
          empty={loading ? 'Loading…' : 'No options match this filter.'}
          renderRow={(row) => (
            <tr key={row.variantId}>
              <td><div className="thumb">{row.thumbUrl ? <img src={row.thumbUrl} alt="" /> : <i className="bi bi-image" />}</div></td>
              <td className="small fw-semibold">
                <Link to={`/products/${row.productId}`} className="text-reset">{row.productName}</Link>
                {row.productStatus !== 'active' && <span className="text-muted fw-normal text-capitalize"> · {row.productStatus}</span>}
              </td>
              <td className="small">{row.optionLabel}</td>
              <td className="small text-muted">{row.sku}</td>
              <td className="small">{formatINR(row.price)}</td>
              <td><StockEditor key={`${row.variantId}-${row.stock}`} row={row} onSaved={refresh} /></td>
              <td><StockPill stock={row.stock} level={row.lowStockLevel} /></td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-light" title="Stock history" onClick={() => setHistory(row)}><i className="bi bi-clock-history" /></button>
              </td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="options" />}
      </div>
      <p className="small text-muted mt-2">
        Type a new number and press Save. Every change is recorded with its reason. Orders, cancellations and returns will update stock automatically from Phase 4.
      </p>
      {history && <HistoryModal row={history} onClose={() => setHistory(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={refresh} />}
    </>
  );
}
