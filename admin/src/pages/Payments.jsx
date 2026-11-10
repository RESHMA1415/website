import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DateRange, useRange } from '../components/charts.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Pagination, SearchBar, StatCard, useDebounced } from '../components/ui.jsx';
import { METHOD, PAYMENT_STATUS, Pill } from '../orderLabels.jsx';

const REFUNDABLE = ['paid', 'partially_refunded', 'refund_initiated', 'cod_collected'];

function RefundModal({ payment, onClose, onDone }) {
  const { notify } = useAuth();
  const left = payment.amount - payment.refundedAmount;
  const isCod = payment.provider === 'cod';
  const [form, setForm] = useState({ amount: left, reason: '', manualReference: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/payments/${payment.id}/refund`, { method: 'POST', body: { ...form, amount: Number(form.amount) } });
      notify(`Refunded ${formatINR(form.amount)} on ${payment.orderNumber}`);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Refund · ${payment.orderNumber}`}
      onClose={onClose}
      footer={<><button type="button" className="btn btn-light" onClick={onClose}>Close</button><button type="submit" form="pay-refund" className="btn btn-danger" disabled={busy}>Refund {formatINR(form.amount)}</button></>}
    >
      <form id="pay-refund" onSubmit={submit}>
        <ErrorNote error={error} />
        <p className="small">{isCod ? 'Pay the customer by UPI or bank transfer first, then record the reference.' : 'The money goes back to the original payment method through Razorpay.'}</p>
        <label className="form-label" htmlFor="pr-amount">Amount (₹, up to {formatINR(left)})</label>
        <input id="pr-amount" type="number" min="1" max={left} className="form-control mb-3" required value={form.amount} onChange={set('amount')} />
        {isCod && (
          <>
            <label className="form-label" htmlFor="pr-ref">UPI / bank transaction reference *</label>
            <input id="pr-ref" className="form-control mb-3" required value={form.manualReference} onChange={set('manualReference')} />
          </>
        )}
        <label className="form-label" htmlFor="pr-reason">Reason</label>
        <input id="pr-reason" className="form-control" maxLength={200} value={form.reason} onChange={set('reason')} />
      </form>
    </Modal>
  );
}

export default function Payments() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState(null);
  const search = useDebounced(q);
  const [range, setRange] = useRange('30d');
  const filters = new URLSearchParams({ q: search, status, provider, from: range.from, to: range.to });
  const { data, loading, error, reload } = useApi(`/admin/payments?${filters}&page=${page}`);
  const t = data?.totals || {};

  return (
    <>
      <PageTitle
        title="Payments"
        subtitle="Online payments, Cash on Delivery and refunds"
        actions={<button type="button" className="btn btn-light" onClick={() => downloadFile(`/admin/payments/export?${filters}`, 'shopme-payments.csv')}><i className="bi bi-download me-1" />Download for Excel</button>}
      />
      {t.needsRefund > 0 && (
        <div className="alert alert-danger small">
          {t.needsRefund} payment(s) need a refund that didn’t go through automatically.{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => { setStatus('refund_initiated'); setPage(1); }}>Show them</button>
        </div>
      )}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="bi-credit-card" label="Collected Online" value={formatINR(t.online)} tone="green" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-cash-coin" label="COD Collected" value={formatINR(t.codCollected)} /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-hourglass-split" label="COD Pending" value={formatINR(t.codPending)} tone="orange" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-arrow-counterclockwise" label="Refunds Issued" value={formatINR(t.refunds)} tone="red" /></div>
      </div>
      <div className="mb-3"><DateRange value={range} onChange={(r) => { setRange(r); setPage(1); }} /></div>
      <div className="panel">
        <SearchBar placeholder="Search order number, customer or Razorpay ID" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(PAYMENT_STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Method" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }}>
            <option value="">Online and COD</option>
            <option value="razorpay">Online (Razorpay)</option>
            <option value="cod">Cash on Delivery</option>
          </select>
        </SearchBar>
        <div className="px-3"><ErrorNote error={error} /></div>
        <DataTable
          columns={['Date', 'Order', 'Customer', 'Amount', 'Method', 'Razorpay ID', 'Status', '']}
          rows={data?.items || []}
          empty={loading ? 'Loading…' : 'No payments yet.'}
          renderRow={(p) => (
            <tr key={p.id}>
              <td className="small text-nowrap">{formatDateTime(p.createdAt)}</td>
              <td>{p.orderNumber ? <Link to={`/orders/${p.orderNumber}`} className="fw-semibold text-nowrap">{p.orderNumber}</Link> : '–'}</td>
              <td className="small">{p.customer}</td>
              <td className="small">
                <span className="fw-semibold">{formatINR(p.amount)}</span>
                {p.refundedAmount > 0 && <div className="text-danger">−{formatINR(p.refundedAmount)} refunded</div>}
              </td>
              <td className="small">{p.provider === 'cod' ? 'COD' : METHOD[p.method] || 'Online'}</td>
              <td className="small text-break">{p.razorpayPaymentId || '–'}</td>
              <td>
                <Pill map={PAYMENT_STATUS} value={p.status} />
                {p.failureReason && <div className="small text-muted" style={{ maxWidth: 220 }}>{p.failureReason}</div>}
              </td>
              <td>
                {REFUNDABLE.includes(p.status) && p.amount > p.refundedAmount && (
                  <button type="button" className="btn btn-sm btn-light text-nowrap" onClick={() => setRefunding(p)}>Refund</button>
                )}
              </td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="payments" />}
      </div>
      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); reload(); }} />}
    </>
  );
}
