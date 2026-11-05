import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';
import { PAYMENT_STATUS } from '../utils/orders.jsx';

// After placing an order. If an online payment is still being confirmed
// (e.g. Razorpay's backup confirmation is on its way), it checks again briefly.
export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const { settings } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer;
    const load = async () => {
      try {
        const next = await api(`/orders/${orderNumber}`);
        if (cancelled) return;
        setOrder(next);
        if (next.status === 'pending_payment' && tries < 10) {
          tries += 1;
          timer = setTimeout(load, 3000);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderNumber]);

  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;
  if (!order) return <div className="container py-5 text-center text-muted">Loading your order…</div>;

  const placed = order.statusHistory.some((h) => h.status === 'confirmed');
  if (!placed) {
    const soldOut = order.status === 'cancelled' && order.cancellation;
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 620 }}>
        <i className={`bi ${soldOut ? 'bi-exclamation-circle text-danger' : 'bi-hourglass-split text-orange'}`} style={{ fontSize: '3rem' }} />
        <h1 className="h3 mt-3">{soldOut ? 'We couldn’t complete this order' : 'Confirming your payment…'}</h1>
        <p className="text-muted">
          {soldOut
            ? order.cancellation.reason
            : 'This can take a minute. If money was taken and the order isn’t confirmed, it will be refunded automatically.'}
        </p>
        {soldOut && order.paymentStatus && <p className="small">{PAYMENT_STATUS[order.paymentStatus]}</p>}
        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center mt-3">
          <Link to="/cart" className="btn btn-orange">Back to Cart</Link>
          <Link to="/contact" className="btn btn-outline-navy">Contact Us</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 680 }}>
      <div className="text-center">
        <div className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 84, height: 84, background: '#e8f6ee' }}>
          <i className="bi bi-check-lg text-success" style={{ fontSize: '2.8rem' }} />
        </div>
        <h1 className="h2">Thank you for your order!</h1>
        <p className="text-muted">
          Your order <strong className="text-navy">{order.orderNumber}</strong> is confirmed.
        </p>
      </div>
      <div className="card-soft p-4 my-4">
        <div className="d-flex justify-content-between mb-2"><span className="text-muted">Order number</span><strong>{order.orderNumber}</strong></div>
        <div className="d-flex justify-content-between mb-2">
          <span className="text-muted">Payment</span>
          <strong className="text-end">{order.paymentMethod === 'cod' ? `Cash on Delivery: pay ${formatINR(order.total)} on delivery` : 'Paid online'}</strong>
        </div>
        <div className="d-flex justify-content-between mb-3">
          <span className="text-muted">Expected delivery</span>
          <strong>{settings.delivery.estimateMinDays}–{settings.delivery.estimateMaxDays} business days</strong>
        </div>
        <hr />
        {order.items.map((item) => (
          <div key={`${item.sku}`} className="d-flex justify-content-between small mb-2 gap-3">
            <span>{item.name}{item.optionLabel ? ` (${item.optionLabel})` : ''} × {item.quantity}</span>
            <span className="text-nowrap">{formatINR(item.price * item.quantity)}</span>
          </div>
        ))}
        <hr />
        <div className="d-flex justify-content-between small mb-1"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
        <div className="d-flex justify-content-between small mb-1"><span>Delivery</span><span>{order.deliveryCharge ? formatINR(order.deliveryCharge) : 'FREE'}</span></div>
        {order.codCharge > 0 && <div className="d-flex justify-content-between small mb-1"><span>Cash on Delivery charge</span><span>{formatINR(order.codCharge)}</span></div>}
        <div className="d-flex justify-content-between fw-bold text-navy mt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
        <hr />
        <div className="small">
          <div className="text-muted mb-1">Delivering to</div>
          <strong>{order.address.fullName}</strong>, {order.address.house}, {order.address.street}, {order.address.city}, {order.address.state} – {order.address.pincode}
        </div>
      </div>
      <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
        <Link to={`/account/orders/${order.orderNumber}`} className="btn btn-navy">Track Order</Link>
        <Link to="/shop" className="btn btn-outline-navy">Continue Shopping</Link>
      </div>
    </div>
  );
}
