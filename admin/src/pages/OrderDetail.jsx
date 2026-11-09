import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorNote, Modal, PageTitle, Panel } from '../components/ui.jsx';
import { METHOD, ORDER_STATUS, PAYMENT_STATUS, Pill, RETURN_STATUS } from '../orderLabels.jsx';

const EMAIL_EVENTS = {
  order_confirmed: 'Order confirmed', order_confirmed_admin: 'New order alert (to you)', order_processing: 'Being packed', order_shipped: 'Shipped with tracking',
  order_out_for_delivery: 'Out for delivery', order_delivered: 'Delivered', order_delivery_failed: 'Delivery unsuccessful', order_cancelled: 'Order cancelled',
  refund_processed: 'Refund processed', return_requested: 'Return request received', return_approved: 'Return approved', return_rejected: 'Return rejected',
  return_pickup_scheduled: 'Pickup arranged', return_received: 'Return received', return_replacement_shipped: 'Replacement shipped',
  review_reminder: 'Review reminder', payment_failed: 'Payment failed – retry',
};

const STATUS_BUTTONS = [
  ['processing', 'Mark Processing', 'bi-box-seam'],
  ['shipped', 'Mark Shipped', 'bi-truck'],
  ['out_for_delivery', 'Out for Delivery', 'bi-signpost'],
  ['delivered', 'Mark Delivered', 'bi-check2-circle'],
];

function addressText(a) {
  if (!a) return '';
  return [a.fullName, `${a.house}, ${a.street}${a.landmark ? `, near ${a.landmark}` : ''}`, `${a.city}, ${a.state} – ${a.pincode}`, `Mobile: ${a.mobile}${a.alternateMobile ? ` / ${a.alternateMobile}` : ''}`].join('\n');
}

// One pop-up for every action: which fields it shows depends on `kind`
function ActionModal({ kind, order, onClose, onDone }) {
  const { notify } = useAuth();
  const isCod = order.paymentMethod === 'cod';
  const [form, setForm] = useState({
    note: '',
    courier: order.shipping?.courier || '',
    trackingNumber: order.shipping?.trackingNumber || '',
    trackingUrl: order.shipping?.trackingUrl || '',
    reason: '',
    restock: false,
    amount: order.refundable || '',
    manualReference: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const base = `/admin/orders/${order.orderNumber}`;

  const config = {
    processing: { title: 'Mark as Processing', button: 'Mark Processing', call: () => api(`${base}/status`, { method: 'POST', body: { status: 'processing', note: form.note } }) },
    shipped: { title: 'Mark as Shipped', button: 'Mark Shipped', call: () => api(`${base}/status`, { method: 'POST', body: { status: 'shipped', ...form } }) },
    out_for_delivery: { title: 'Out for Delivery', button: 'Save', call: () => api(`${base}/status`, { method: 'POST', body: { status: 'out_for_delivery', note: form.note } }) },
    delivered: { title: 'Mark as Delivered', button: 'Mark Delivered', call: () => api(`${base}/status`, { method: 'POST', body: { status: 'delivered', note: form.note } }) },
    delivery_failed: { title: 'Delivery failed / returning to us', button: 'Save', danger: true, call: () => api(`${base}/status`, { method: 'POST', body: { status: 'delivery_failed', note: form.note, restock: form.restock } }) },
    editShipping: { title: 'Edit courier details', button: 'Save', call: () => api(`${base}/shipping`, { method: 'POST', body: form }) },
    cancel: { title: `Cancel order ${order.orderNumber}`, button: 'Cancel order', danger: true, call: () => api(`${base}/cancel`, { method: 'POST', body: { reason: form.reason } }) },
    refund: {
      title: 'Issue a refund',
      button: `Refund ${form.amount ? formatINR(form.amount) : ''}`,
      danger: true,
      call: () => api(`${base}/refund`, { method: 'POST', body: { amount: Number(form.amount), reason: form.reason, manualReference: form.manualReference } }),
    },
  }[kind];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await config.call();
      notify(`${order.orderNumber}: saved`);
      onDone(updated);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={config.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Close</button>
          <button type="submit" form="order-action" className={`btn ${config.danger ? 'btn-danger' : 'btn-orange'}`} disabled={busy}>{busy ? 'Saving…' : config.button}</button>
        </>
      }
    >
      <form id="order-action" onSubmit={submit}>
        <ErrorNote error={error} />
        {(kind === 'shipped' || kind === 'editShipping') && (
          <>
            <div className="mb-3">
              <label className="form-label" htmlFor="ship-courier">Courier name *</label>
              <input id="ship-courier" className="form-control" required maxLength={60} placeholder="e.g. Delhivery, DTDC, India Post" value={form.courier} onChange={set('courier')} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="ship-number">Tracking number *</label>
              <input id="ship-number" className="form-control" required maxLength={60} value={form.trackingNumber} onChange={set('trackingNumber')} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="ship-url">Tracking link (optional)</label>
              <input id="ship-url" type="url" className="form-control" placeholder="https://…" value={form.trackingUrl} onChange={set('trackingUrl')} />
              <div className="form-text">The customer gets a “Track on courier website” button with this link.</div>
            </div>
          </>
        )}
        {kind === 'delivered' && isCod && order.paymentStatus === 'cod_pending' && (
          <div className="alert alert-info small py-2">The payment will be recorded as <strong>COD collected ({formatINR(order.total)})</strong>.</div>
        )}
        {kind === 'delivery_failed' && (
          <>
            <p className="small">Use this when the courier couldn’t deliver and the parcel is coming back to you. The customer is told we’ll contact them.{isCod ? ' The COD amount is marked as not collected.' : ' You can refund the customer from this page afterwards.'}</p>
            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="rto-restock" checked={form.restock} onChange={set('restock')} />
              <label className="form-check-label" htmlFor="rto-restock">The parcel is already back with us: put the items back in stock</label>
            </div>
          </>
        )}
        {kind === 'cancel' && (
          <>
            <p className="small">The items go back into stock. {isCod ? 'Nothing was paid for this Cash on Delivery order.' : `The customer’s payment (${formatINR(order.refundable)}) is refunded in full automatically.`}</p>
            <label className="form-label" htmlFor="cancel-reason">Reason (the customer will see this) *</label>
            <textarea id="cancel-reason" className="form-control" rows={3} required maxLength={300} placeholder="e.g. Sorry, this item is out of stock" value={form.reason} onChange={set('reason')} />
          </>
        )}
        {kind === 'refund' && (
          <>
            <p className="small">
              {isCod
                ? 'Cash on Delivery refunds are paid by you (UPI or bank transfer). Pay the customer first, then record the transaction reference here.'
                : order.onlineRefundsAvailable
                  ? 'The money goes back to the customer’s original payment method through Razorpay (5–7 business days).'
                  : 'Online refunds need the Razorpay keys, which aren’t added yet.'}
            </p>
            <div className="mb-3">
              <label className="form-label" htmlFor="refund-amount">Amount (₹) *</label>
              <input id="refund-amount" type="number" min="1" max={order.refundable} className="form-control" required value={form.amount} onChange={set('amount')} />
              <div className="form-text">Up to {formatINR(order.refundable)} can still be refunded on this order.</div>
            </div>
            {isCod && (
              <div className="mb-3">
                <label className="form-label" htmlFor="refund-ref">UPI / bank transaction reference *</label>
                <input id="refund-ref" className="form-control" required maxLength={80} value={form.manualReference} onChange={set('manualReference')} />
              </div>
            )}
            <label className="form-label" htmlFor="refund-reason">Reason</label>
            <input id="refund-reason" className="form-control" maxLength={200} placeholder="e.g. Parcel returned by courier" value={form.reason} onChange={set('reason')} />
          </>
        )}
        {['processing', 'shipped', 'out_for_delivery', 'delivered', 'delivery_failed'].includes(kind) && (
          <div>
            <label className="form-label" htmlFor="status-note">Note for the timeline (optional, only you see it)</label>
            <input id="status-note" className="form-control" maxLength={300} value={form.note} onChange={set('note')} />
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { notify } = useAuth();
  const { data, error, loading, reload } = useApi(`/admin/orders/${orderNumber}`);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [order, setOrder] = useState(null);
  const o = order?.orderNumber === orderNumber ? order : data;

  const done = (updated) => {
    setAction(null);
    if (updated?.orderNumber) setOrder(updated);
    else reload();
  };
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(addressText(o.address));
      notify('Address copied');
    } catch {
      notify('Couldn’t copy. Please select the address and copy it.', 'error');
    }
  };
  const addNote = async (e) => {
    e.preventDefault();
    try {
      setOrder(await api(`/admin/orders/${orderNumber}/notes`, { method: 'POST', body: { text: note } }));
      setNote('');
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const rtoReceived = async () => {
    if (!window.confirm('Put these items back in stock now?')) return;
    try {
      setOrder(await api(`/admin/orders/${orderNumber}/rto-received`, { method: 'POST' }));
      notify('Items put back in stock');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (error && !o) return <><PageTitle title={`Order ${orderNumber}`} /><ErrorNote error={error} /><Link to="/orders">Back to orders</Link></>;
  if (!o) return <div className="text-muted">{loading ? 'Loading order…' : ''}</div>;
  const a = o.actions;

  return (
    <>
      <PageTitle
        title={<>Order {o.orderNumber} <Pill map={ORDER_STATUS} value={o.status} /></>}
        subtitle={`Placed ${formatDateTime(o.createdAt)} · ${o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}`}
        actions={
          <>
            <Link to="/orders" className="btn btn-light"><i className="bi bi-arrow-left me-1" />Orders</Link>
            <Link to={`/orders/print?orders=${o.orderNumber}`} className="btn btn-light"><i className="bi bi-printer me-1" />Packing slip</Link>
          </>
        }
      />

      <div className="panel mb-4">
        <div className="panel-body d-flex flex-wrap gap-2 align-items-center">
          <span className="small text-muted me-1">Next step:</span>
          {STATUS_BUTTONS.filter(([key]) => a[key]).map(([key, label, icon]) => (
            <button key={key} type="button" className="btn btn-orange btn-sm" onClick={() => setAction(key)}><i className={`bi ${icon} me-1`} />{label}</button>
          ))}
          {a.delivery_failed && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setAction('delivery_failed')}>Delivery failed / RTO</button>}
          {a.rtoReceived && <button type="button" className="btn btn-outline-navy btn-sm" onClick={rtoReceived}>Parcel back: restock items</button>}
          {a.editShipping && <button type="button" className="btn btn-light btn-sm" onClick={() => setAction('editShipping')}>Edit courier details</button>}
          {a.refund && <button type="button" className="btn btn-light btn-sm" onClick={() => setAction('refund')}><i className="bi bi-arrow-counterclockwise me-1" />Refund</button>}
          {a.cancel && <button type="button" className="btn btn-outline-danger btn-sm ms-auto" onClick={() => setAction('cancel')}>Cancel order</button>}
          {!Object.values(a).some(Boolean) && <span className="small text-muted">Nothing to do on this order.</span>}
        </div>
        {o.paymentStatus === 'refund_initiated' && (
          <div className="alert alert-danger small m-3 mt-0">The automatic refund didn’t go through. Please refund {formatINR(o.refundable)} with the Refund button.</div>
        )}
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <Panel title="Items" bodyClass="p-0">
            <div className="table-responsive">
              <table className="table mb-0">
                <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Qty</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i._id}>
                      <td>
                        <div className="d-flex gap-2 align-items-center">
                          <div className="thumb">{i.imageUrl ? <img src={i.imageUrl} alt="" /> : <i className="bi bi-image" />}</div>
                          <div className="small">
                            <div className="fw-semibold">{i.name}</div>
                            <div className="text-muted">{i.optionLabel}{i.isReturnable === false ? ' · Non-returnable' : ''}{i.returnRequestedQty ? ` · ${i.returnRequestedQty} in return` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">{i.sku}</td>
                      <td className="small">{formatINR(i.price)}{i.mrp > i.price && <div className="text-muted text-decoration-line-through">{formatINR(i.mrp)}</div>}</td>
                      <td>{i.quantity}</td>
                      <td className="text-end fw-semibold">{formatINR(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 small ms-auto" style={{ maxWidth: 320 }}>
              <div className="d-flex justify-content-between"><span>Subtotal</span><span>{formatINR(o.subtotal)}</span></div>
              <div className="d-flex justify-content-between"><span>Delivery</span><span>{o.deliveryCharge ? formatINR(o.deliveryCharge) : 'FREE'}</span></div>
              {o.codCharge > 0 && <div className="d-flex justify-content-between"><span>COD charge</span><span>{formatINR(o.codCharge)}</span></div>}
              <div className="d-flex justify-content-between fw-bold border-top mt-1 pt-1"><span>Total</span><span>{formatINR(o.total)}</span></div>
              {o.refundedAmount > 0 && <div className="d-flex justify-content-between text-danger"><span>Refunded</span><span>−{formatINR(o.refundedAmount)}</span></div>}
            </div>
          </Panel>

          <div className="mt-4">
            <Panel title="Payments" bodyClass="p-0">
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Razorpay ID</th><th>Status</th></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p._id}>
                        <td className="small text-nowrap">{formatDateTime(p.createdAt)}</td>
                        <td className="small">{p.provider === 'cod' ? 'Cash on Delivery' : METHOD[p.method] || 'Online'}</td>
                        <td className="small">
                          {formatINR(p.amount)}
                          {p.refunds.map((r) => <div key={r._id} className="text-danger">−{formatINR(r.amount)} {r.razorpayRefundId || r.manualReference ? `(${r.razorpayRefundId || r.manualReference})` : ''}</div>)}
                        </td>
                        <td className="small text-break">{p.razorpayPaymentId || '–'}</td>
                        <td>
                          <Pill map={PAYMENT_STATUS} value={p.status} />
                          {p.failureReason && <div className="small text-muted">{p.failureReason}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {o.returns.length > 0 && (
            <div className="mt-4">
              <Panel title="Returns & exchanges" bodyClass="p-0">
                <ul className="list-group list-group-flush">
                  {o.returns.map((r) => (
                    <li key={r.id} className="list-group-item d-flex flex-wrap justify-content-between gap-2 align-items-center">
                      <div className="small">
                        <strong className="text-capitalize">{r.type}</strong> · {r.items.map((i) => `${i.name} (${i.optionLabel}) × ${i.quantity}`).join(', ')}
                        <div className="text-muted">Requested {formatDateTime(r.createdAt)}</div>
                      </div>
                      <div className="d-flex gap-2 align-items-center">
                        <Pill map={RETURN_STATUS} value={r.statusRaw} />
                        <Link to={`/returns?open=${r.id}`} className="btn btn-sm btn-light">Open</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          <div className="mt-4">
            <Panel title="Emails to the customer" bodyClass="p-0">
              {o.messages?.length ? (
                <ul className="list-group list-group-flush small">
                  {o.messages.map((n) => (
                    <li key={n._id} className="list-group-item d-flex flex-wrap justify-content-between gap-2">
                      <span>{EMAIL_EVENTS[n.event] || n.event.replace(/_/g, ' ')}<span className="text-muted"> · {n.recipient}</span></span>
                      <span className="text-nowrap">
                        <span className={`status-pill ${{ sent: 'tone-green', failed: 'tone-red', logged: 'tone-muted', skipped: 'tone-muted', queued: 'tone-orange' }[n.status] || 'tone-muted'}`} title={n.error || ''}>
                          {{ sent: 'Sent', failed: n.attempts >= 3 ? 'Failed' : 'Retrying', logged: 'Not sent (email not set up)', skipped: 'Switched off', queued: 'Sending' }[n.status] || n.status}
                        </span>
                        <span className="text-muted ms-2">{formatDateTime(n.sentAt || n.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <div className="small text-muted p-3">No emails yet.</div>}
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title="Internal notes (only you see these)">
              {o.internalNotes?.length ? (
                <ul className="list-unstyled small mb-3">
                  {[...o.internalNotes].reverse().map((n) => (
                    <li key={n._id} className="mb-2"><span className="text-muted">{formatDateTime(n.at)}:</span> {n.text}</li>
                  ))}
                </ul>
              ) : <p className="small text-muted">No notes yet.</p>}
              <form className="d-flex gap-2" onSubmit={addNote}>
                <input className="form-control form-control-sm" maxLength={1000} placeholder="Add a note, e.g. customer asked for evening delivery" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
                <button type="submit" className="btn btn-sm btn-orange" disabled={!note.trim()}>Add</button>
              </form>
            </Panel>
          </div>
        </div>

        <div className="col-lg-4">
          <Panel title="Customer">
            {o.customer ? (
              <div className="small">
                <div className="fw-semibold">{o.customer.name}</div>
                <div>{o.customer.email}</div>
                <div>{o.customer.mobile}</div>
                <div className="text-muted mt-1">{o.customer.orderCount} order(s){o.customer.isBlocked ? ' · Blocked' : ''}</div>
              </div>
            ) : <div className="small text-muted">This customer deleted their account.</div>}
          </Panel>
          <div className="mt-4">
            <Panel title="Delivery address" actions={<button type="button" className="btn btn-sm btn-light" onClick={copyAddress}><i className="bi bi-clipboard me-1" />Copy</button>}>
              <div className="small" style={{ whiteSpace: 'pre-line' }}>{addressText(o.address)}</div>
            </Panel>
          </div>
          {o.shipping?.trackingNumber && (
            <div className="mt-4">
              <Panel title="Shipping">
                <div className="small">
                  <div><span className="text-muted">Courier:</span> {o.shipping.courier}</div>
                  <div><span className="text-muted">Tracking no.:</span> {o.shipping.trackingNumber}</div>
                  {o.shipping.trackingUrl && <a href={o.shipping.trackingUrl} target="_blank" rel="noreferrer">Open tracking page <i className="bi bi-box-arrow-up-right" /></a>}
                  {o.returnWindowEndsAt && <div className="text-muted mt-2">Return window ends {formatDateTime(o.returnWindowEndsAt)}</div>}
                </div>
              </Panel>
            </div>
          )}
          <div className="mt-4">
            <Panel title="Timeline">
              <ul className="order-timeline small">
                {o.statusHistory.map((h) => (
                  <li key={h._id}>
                    <div className="fw-semibold">{ORDER_STATUS[h.status]?.[0] || h.status}</div>
                    <div className="text-muted">{formatDateTime(h.at)} · {h.by === 'customer' ? 'Customer' : h.by === 'admin' ? 'You' : 'Automatic'}</div>
                    {h.note && <div>{h.note}</div>}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>

      {action && <ActionModal kind={action} order={o} onClose={() => setAction(null)} onDone={done} />}
    </>
  );
}
