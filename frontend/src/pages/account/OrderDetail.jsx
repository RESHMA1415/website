import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import ReturnProgress from '../../components/ReturnProgress.jsx';
import TrackingCard from '../../components/TrackingCard.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDate, formatINR, whatsappLink } from '../../utils/format.js';
import { PAYMENT_METHOD, PAYMENT_STATUS, StatusBadge } from '../../utils/orders.jsx';
import AccountLayout from './AccountLayout.jsx';

// Reasons a customer can give for cancelling (PRD §10.1)
const CANCEL_REASONS = [
  ['changed_mind', 'Changed my mind'],
  ['ordered_by_mistake', 'Ordered by mistake'],
  ['found_cheaper', 'Found it cheaper elsewhere'],
  ['delivery_too_slow', 'Delivery is too slow'],
  ['other', 'Other'],
];

function CancelModal({ order, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api(`/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { reason, comment } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="shop-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="shop-modal p-4" role="dialog" aria-modal="true" aria-label="Cancel order" onSubmit={submit} style={{ maxWidth: 480 }}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h2 className="h5 mb-0">Cancel order {order.orderNumber}?</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <p className="small text-muted">
          {order.paymentMethod === 'cod'
            ? 'This is a Cash on Delivery order, so nothing has been charged.'
            : `Your full payment of ${formatINR(order.total - (order.refundedAmount || 0))} will be refunded to your original payment method (5–7 business days).`}
        </p>
        <label className="form-label" htmlFor="cancel-reason">Why are you cancelling? *</label>
        <select id="cancel-reason" className="form-select mb-3" required value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          {CANCEL_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="form-label" htmlFor="cancel-comment">Anything else? (optional)</label>
        <textarea id="cancel-comment" className="form-control mb-3" rows={2} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <div className="alert alert-danger small py-2">{error}</div>}
        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-navy" onClick={onClose}>Keep my order</button>
          <button type="submit" className="btn btn-danger" disabled={busy || !reason}>{busy ? 'Cancelling…' : 'Cancel Order'}</button>
        </div>
      </form>
    </div>
  );
}

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings, notify } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    api(`/orders/${orderNumber}`).then(setOrder).catch((err) => setError(err.message));
  }, [orderNumber]);
  useEffect(load, [load]);

  const cancelled = (result) => {
    setCancelling(false);
    notify(result.refund?.ok ? `Order cancelled. Your refund of ${formatINR(result.refund.amount)} has been started.` : 'Your order has been cancelled.');
    load();
  };

  return (
    <AccountLayout title={`Order ${orderNumber}`} crumbs={[{ label: 'Orders', to: '/account/orders' }, { label: orderNumber }]}>
      {error && <div className="alert alert-danger">{error} <Link to="/account/orders">Back to My Orders</Link></div>}
      {!order && !error && <div className="card-soft p-4 text-muted">Loading your order…</div>}
      {order && (
        <div className="row g-4">
          <div className="col-md-7">
            <div className="card-soft p-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 className="h5 mb-0">Items</h2>
                  <div className="small text-muted">Placed on {formatDate(order.createdAt)}</div>
                </div>
                <StatusBadge status={order.status} />
              </div>
              {order.items.map((item) => (
                <div key={item.sku} className="d-flex gap-3 align-items-center mb-3">
                  <div className="cart-line-image" style={{ width: 56, height: 70 }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}
                  </div>
                  <div className="flex-grow-1 small" style={{ minWidth: 0 }}>
                    <div className="fw-semibold">{item.name}</div>
                    <div className="text-muted">{item.optionLabel}{item.optionLabel ? ' · ' : ''}Qty {item.quantity} × {formatINR(item.price)}</div>
                  </div>
                  <div className="fw-semibold text-nowrap">{formatINR(item.price * item.quantity)}</div>
                </div>
              ))}
              <hr />
              <div className="d-flex justify-content-between small mb-1"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
              <div className="d-flex justify-content-between small mb-1"><span>Delivery</span><span>{order.deliveryCharge ? formatINR(order.deliveryCharge) : 'FREE'}</span></div>
              {order.codCharge > 0 && <div className="d-flex justify-content-between small mb-1"><span>Cash on Delivery charge</span><span>{formatINR(order.codCharge)}</span></div>}
              {order.savings > 0 && <div className="d-flex justify-content-between small mb-1 text-success"><span>You saved</span><span>{formatINR(order.savings)}</span></div>}
              <div className="d-flex justify-content-between fw-bold text-navy mt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-sm-6">
                <div className="card-soft p-3 h-100 small">
                  <div className="text-muted mb-1">Delivery address</div>
                  <strong>{order.address.fullName}</strong>
                  <div>{order.address.house}, {order.address.street}{order.address.landmark ? `, near ${order.address.landmark}` : ''}</div>
                  <div>{order.address.city}, {order.address.state} – {order.address.pincode}</div>
                  <div>Mobile: {order.address.mobile}</div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="card-soft p-3 h-100 small">
                  <div className="text-muted mb-1">Payment</div>
                  <strong>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : PAYMENT_METHOD[order.payment?.method] || 'Online'}</strong>
                  <div>{PAYMENT_STATUS[order.paymentStatus] || order.paymentStatus}</div>
                  {order.refundedAmount > 0 && <div className="text-success">Refunded {formatINR(order.refundedAmount)}</div>}
                </div>
              </div>
            </div>

            <div className="card-soft p-4">
              <h2 className="h5 mb-3">Need something?</h2>
              <div className="d-flex flex-wrap gap-2">
                {order.canCancel && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setCancelling(true)}>Cancel Order</button>}
                {order.canReturn && <Link className="btn btn-outline-navy btn-sm" to={`/account/orders/${order.orderNumber}/return`}>Return / Exchange</Link>}
                {order.status === 'delivered' && <button type="button" className="btn btn-outline-navy btn-sm" disabled title="Reviews arrive in the next update">Write a Review (coming soon)</button>}
                <Link className="btn btn-outline-navy btn-sm" to={`/account/orders/${order.orderNumber}/receipt`}><i className="bi bi-receipt me-1" />Download Receipt</Link>
                {settings.store.whatsappNumber && (
                  <a
                    className="btn btn-outline-success btn-sm"
                    href={whatsappLink(settings.store.whatsappNumber, `Hi, I need help with my order ${order.orderNumber}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-whatsapp me-1" />Need help?
                  </a>
                )}
              </div>
              {order.returnWindowEndsAt && (
                <p className="small text-muted mt-3 mb-0">
                  {order.canReturn
                    ? `Return or exchange possible until ${formatDate(order.returnWindowEndsAt)}.`
                    : new Date(order.returnWindowEndsAt) < new Date() ? `The return window ended on ${formatDate(order.returnWindowEndsAt)}.` : ''}
                </p>
              )}
              {['shipped', 'out_for_delivery'].includes(order.status) && (
                <p className="small text-muted mt-3 mb-0">Your order has shipped, so it can’t be cancelled now. You can return it after delivery.</p>
              )}
            </div>
            {order.returns?.length > 0 && (
              <div className="card-soft p-4 mt-4">
                <h2 className="h5 mb-3">Returns & exchanges</h2>
                <ReturnProgress returns={order.returns} />
              </div>
            )}
          </div>
          <div className="col-md-5">
            <div className="card-soft p-4">
              <h2 className="h5 mb-3">Tracking</h2>
              {order.status === 'cancelled' ? (
                <div className="small">
                  <StatusBadge status="cancelled" />
                  {order.cancellation?.reason && <p className="mt-2 mb-0">{order.cancellation.reason}</p>}
                </div>
              ) : (
                <>
                  <OrderTimeline history={order.statusHistory} />
                  <TrackingCard shipping={order.shipping} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {cancelling && order && <CancelModal order={order} onClose={() => setCancelling(false)} onDone={cancelled} />}
    </AccountLayout>
  );
}
