import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';
import { Pill, RETURN_STATUS } from '../orderLabels.jsx';

const TABS = [
  ['requested', 'Requested'],
  ['approved', 'Approved'],
  ['pickup', 'Pickup Scheduled'],
  ['received', 'Received'],
  ['completed', 'Completed'],
  ['rejected', 'Rejected'],
];

// One return/exchange request with the next steps (PRD §10.5)
function ReturnModal({ id, onClose, onChanged }) {
  const { notify } = useAuth();
  const { data, error, reload } = useApi(`/admin/returns/${id}`);
  const [r, setR] = useState(null);
  const req = r || data;
  const [form, setForm] = useState({ reason: '', tracking: '', restock: true, amount: '', manualReference: '', courier: '', trackingNumber: '', trackingUrl: '' });
  const [step, setStep] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async (action, body = {}) => {
    setBusy(true);
    setErr('');
    try {
      const updated = await api(`/admin/returns/${id}/${action}`, { method: 'POST', body });
      setR(updated);
      setStep('');
      notify('Saved');
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!req) return <Modal title="Return request" onClose={onClose}><ErrorNote error={error} />{!error && 'Loading…'}</Modal>;
  const a = req.actions;
  const owed = req.refundAmount - req.refundedAmount;
  const refundForm = (action, label, amount) => (
    <form className="border rounded p-3 mt-3" onSubmit={(e) => { e.preventDefault(); run(action, { amount: form.amount || undefined, manualReference: form.manualReference }); }}>
      <div className="fw-semibold mb-2">{label}</div>
      <p className="small text-muted">
        {a.cod ? 'This was a Cash on Delivery order: send the money to the customer’s UPI/bank account below, then record the reference.' : 'The money goes back to the customer’s original payment method through Razorpay.'}
      </p>
      <div className="row g-2">
        <div className="col-sm-4">
          <label className="form-label" htmlFor="ret-amount">Amount (₹)</label>
          <input id="ret-amount" type="number" min="1" max={amount} className="form-control form-control-sm" placeholder={String(amount)} value={form.amount} onChange={set('amount')} />
        </div>
        {a.cod && (
          <div className="col-sm-8">
            <label className="form-label" htmlFor="ret-ref">UPI / bank transaction reference *</label>
            <input id="ret-ref" className="form-control form-control-sm" required value={form.manualReference} onChange={set('manualReference')} />
          </div>
        )}
      </div>
      <button type="submit" className="btn btn-sm btn-danger mt-2" disabled={busy}>Refund {formatINR(form.amount || amount)}</button>
    </form>
  );

  return (
    <Modal title={`${req.type === 'exchange' ? 'Exchange' : 'Return'} · order ${req.order.orderNumber}`} onClose={onClose} size="lg">
      <ErrorNote error={err} />
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <div className="small">
          <div><Pill map={RETURN_STATUS} value={req.status} /> <span className="text-muted ms-1">requested {formatDateTime(req.createdAt)}</span></div>
          <div className="mt-1"><strong>{req.customer?.name || 'Deleted account'}</strong> {req.customer && `· ${req.customer.mobile} · ${req.customer.email}`}</div>
          <div className="text-muted">Order {req.order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'paid online'} · delivered {formatDateTime(req.order.deliveredAt)}</div>
        </div>
        <Link to={`/orders/${req.order.orderNumber}`} className="btn btn-sm btn-light align-self-start">Open order</Link>
      </div>

      <div className="table-responsive mb-3">
        <table className="table table-sm">
          <thead><tr><th>Item</th><th>Qty</th><th>Paid</th>{req.type === 'exchange' && <th>Exchange to</th>}</tr></thead>
          <tbody>
            {req.items.map((i, n) => (
              <tr key={n}>
                <td className="small"><div className="fw-semibold">{i.name}</div><div className="text-muted">{i.optionLabel} · {i.sku}</div></td>
                <td>{i.quantity}</td>
                <td className="small">{formatINR(i.price)}</td>
                {req.type === 'exchange' && (
                  <td className="small">
                    {i.exchangeTo ? <>{i.exchangeTo.optionLabel} · {formatINR(i.exchangeTo.price)}<div className={i.exchangeTo.stock > 0 ? 'text-muted' : 'text-danger'}>{i.exchangeTo.stock > 0 ? `${i.exchangeTo.stock} in stock` : 'Out of stock'}</div></> : 'Option removed'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row g-3 small mb-3">
        <div className="col-md-6">
          <div className="text-muted">Reason</div>
          <div className="fw-semibold">{req.reason}</div>
          {req.comments && <div className="mt-1">“{req.comments}”</div>}
          {req.rejectionReason && <div className="text-danger mt-1">Rejected: {req.rejectionReason}</div>}
        </div>
        <div className="col-md-6">
          <div className="text-muted">Pickup address</div>
          <div>{req.pickupAddress?.fullName}, {req.pickupAddress?.house}, {req.pickupAddress?.street}, {req.pickupAddress?.city} – {req.pickupAddress?.pincode} · {req.pickupAddress?.mobile}</div>
        </div>
        {req.refundDetails && (req.refundDetails.upiId || req.refundDetails.accountNumber) && (
          <div className="col-md-6">
            <div className="text-muted">Refund to (COD)</div>
            {req.refundDetails.upiId ? <div>UPI: <strong>{req.refundDetails.upiId}</strong></div> : <div>{req.refundDetails.accountHolder} · A/c {req.refundDetails.accountNumber} · IFSC {req.refundDetails.ifsc}</div>}
          </div>
        )}
        <div className="col-md-6">
          <div className="text-muted">Money due back</div>
          <div className="fw-semibold">{formatINR(req.refundAmount)}{req.includesDeliveryCharge ? ' (includes delivery charge: our mistake)' : ''}</div>
          {req.refundedAmount > 0 && <div className="text-success">Refunded {formatINR(req.refundedAmount)}{req.refundReference ? ` · ref ${req.refundReference}` : ''}</div>}
        </div>
      </div>

      {req.photos?.length > 0 && (
        <div className="mb-3">
          <div className="small text-muted mb-1">Customer’s photos</div>
          <div className="d-flex flex-wrap gap-2">
            {req.photos.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Customer photo" className="return-photo" /></a>)}
          </div>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 border-top pt-3">
        {a.approve && <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={() => run('approve')}>Approve</button>}
        {a.reject && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setStep('reject')}>Reject</button>}
        {a.pickup && <button type="button" className="btn btn-sm btn-orange" onClick={() => setStep('pickup')}>Pickup scheduled</button>}
        {a.receive && <button type="button" className="btn btn-sm btn-orange" onClick={() => setStep('receive')}>Item received</button>}
        {a.shipReplacement && <button type="button" className="btn btn-sm btn-orange" onClick={() => setStep('ship')}>Ship replacement</button>}
        {a.refund && <button type="button" className="btn btn-sm btn-danger" onClick={() => setStep('refund')}>Refund {formatINR(owed)}</button>}
        {a.refundInstead && <button type="button" className="btn btn-sm btn-light" onClick={() => setStep('refund-instead')}>Refund instead of exchange</button>}
        {a.close && <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => run('close')}>Close request</button>}
        {!Object.entries(a).some(([k, v]) => k !== 'cod' && v) && <span className="small text-muted">This request is finished.</span>}
      </div>

      {step === 'reject' && (
        <form className="border rounded p-3 mt-3" onSubmit={(e) => { e.preventDefault(); run('reject', { reason: form.reason }); }}>
          <label className="form-label" htmlFor="ret-reject">Reason (the customer will see this) *</label>
          <textarea id="ret-reject" className="form-control form-control-sm" rows={2} required maxLength={300} value={form.reason} onChange={set('reason')} />
          <button type="submit" className="btn btn-sm btn-danger mt-2" disabled={busy}>Reject request</button>
        </form>
      )}
      {step === 'pickup' && (
        <form className="border rounded p-3 mt-3" onSubmit={(e) => { e.preventDefault(); run('pickup', { tracking: form.tracking }); }}>
          <label className="form-label" htmlFor="ret-tracking">Reverse pickup tracking number (optional)</label>
          <input id="ret-tracking" className="form-control form-control-sm" maxLength={80} value={form.tracking} onChange={set('tracking')} />
          <button type="submit" className="btn btn-sm btn-orange mt-2" disabled={busy}>Save</button>
        </form>
      )}
      {step === 'receive' && (
        <form className="border rounded p-3 mt-3" onSubmit={(e) => { e.preventDefault(); run('receive', { restock: form.restock }); }}>
          <div className="fw-semibold mb-2">Inspect the item(s)</div>
          <div className="form-check">
            <input id="ret-restock" type="checkbox" className="form-check-input" checked={form.restock} onChange={set('restock')} />
            <label htmlFor="ret-restock" className="form-check-label">Restock: Yes, the item can be sold again (untick if damaged)</label>
          </div>
          <button type="submit" className="btn btn-sm btn-orange mt-2" disabled={busy}>Mark received</button>
        </form>
      )}
      {step === 'ship' && (
        <form className="border rounded p-3 mt-3" onSubmit={(e) => { e.preventDefault(); run('ship-replacement', form); }}>
          <div className="fw-semibold mb-2">Replacement shipment (new size/colour is taken from stock)</div>
          <div className="row g-2">
            <div className="col-sm-4"><input className="form-control form-control-sm" required placeholder="Courier *" aria-label="Courier" value={form.courier} onChange={set('courier')} /></div>
            <div className="col-sm-4"><input className="form-control form-control-sm" required placeholder="Tracking number *" aria-label="Tracking number" value={form.trackingNumber} onChange={set('trackingNumber')} /></div>
            <div className="col-sm-4"><input className="form-control form-control-sm" type="url" placeholder="Tracking link" aria-label="Tracking link" value={form.trackingUrl} onChange={set('trackingUrl')} /></div>
          </div>
          <button type="submit" className="btn btn-sm btn-orange mt-2" disabled={busy}>Mark replacement shipped</button>
        </form>
      )}
      {step === 'refund' && refundForm('refund', req.type === 'exchange' ? 'Refund the price difference' : 'Refund the return', owed)}
      {step === 'refund-instead' && refundForm('refund-instead', 'Refund instead of exchange (full price of the item)', req.items.reduce((s, i) => s + i.price * i.quantity, 0) - req.refundedAmount)}

      <div className="mt-3">
        <div className="small text-muted mb-1">History</div>
        <ul className="order-timeline small">
          {req.statusHistory.map((h) => (
            <li key={h._id}>
              <span className="fw-semibold">{RETURN_STATUS[h.status]?.[0] || h.status}</span> · <span className="text-muted">{formatDateTime(h.at)}</span>
              {h.note && <div>{h.note}</div>}
            </li>
          ))}
        </ul>
      </div>
      {error && <button type="button" className="btn btn-link btn-sm" onClick={reload}>Reload</button>}
    </Modal>
  );
}

export default function Returns() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('requested');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi(`/admin/returns?${new URLSearchParams({ tab, page, q: search })}`);
  const open = params.get('open');
  const setOpen = (id) => setParams(id ? { open: id } : {});

  return (
    <>
      <PageTitle title="Returns & Exchanges" subtitle="Approve requests, arrange pickups, restock and refund" />
      <div className="panel">
        <ul className="nav nav-tabs px-3 pt-2">
          {TABS.map(([key, label]) => (
            <li key={key} className="nav-item">
              <button type="button" className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setPage(1); }}>
                {label}
                {data?.counts?.[key] > 0 && <span className="badge rounded-pill text-bg-light ms-1">{data.counts[key]}</span>}
              </button>
            </li>
          ))}
        </ul>
        <SearchBar placeholder="Search order number, customer or mobile" value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        <div className="px-3"><ErrorNote error={error} /></div>
        <DataTable
          columns={['Order', 'Customer', 'Type', 'Items', 'Reason', 'Requested', 'Status', '']}
          rows={data?.items || []}
          empty={loading ? 'Loading…' : 'No return or exchange requests here.'}
          renderRow={(r) => (
            <tr key={r.id}>
              <td><Link to={`/orders/${r.orderNumber}`} className="fw-semibold text-nowrap">{r.orderNumber}</Link></td>
              <td className="small">{r.customer}</td>
              <td className="small text-capitalize">{r.type}</td>
              <td>{r.itemsCount}</td>
              <td className="small">{r.reason}</td>
              <td className="small text-nowrap">{formatDateTime(r.createdAt)}</td>
              <td><Pill map={RETURN_STATUS} value={r.status} /></td>
              <td><button type="button" className="btn btn-sm btn-light" onClick={() => setOpen(r.id)}>Open</button></td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="requests" />}
      </div>
      {open && <ReturnModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
