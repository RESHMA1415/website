import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDateTime, formatINR } from '../../utils/format.js';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '../../utils/orders.jsx';

// Order receipt to print or save as PDF (PRD §13.11 "Download Receipt").
// SHOPME is not GST-registered, so this is a receipt, not a tax invoice.
export default function Receipt() {
  const { orderNumber } = useParams();
  const { settings } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${orderNumber}`).then(setOrder).catch((err) => setError(err.message));
  }, [orderNumber]);

  return (
    <div className="container py-4">
      <div className="no-print d-flex flex-wrap gap-2 mb-3">
        <Link to={`/account/orders/${orderNumber}`} className="btn btn-outline-navy btn-sm"><i className="bi bi-arrow-left me-1" />Back to order</Link>
        <button type="button" className="btn btn-orange btn-sm" disabled={!order} onClick={() => window.print()}><i className="bi bi-printer me-1" />Print or save as PDF</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {!order && !error && <div className="text-muted">Loading…</div>}
      {order && (
        <div className="receipt card-soft p-4">
          <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
            <div>
              <div className="h4 mb-0 text-navy">{settings.store.name}</div>
              <div className="small">{settings.store.address}</div>
              <div className="small">{settings.store.phone} · {settings.store.email}</div>
            </div>
            <div className="text-md-end">
              <div className="fw-bold">ORDER RECEIPT</div>
              <div>{order.orderNumber}</div>
              <div className="small text-muted">{formatDateTime(order.createdAt)}</div>
            </div>
          </div>
          <div className="row g-3 mb-4 small">
            <div className="col-sm-6">
              <div className="text-muted">Delivered to</div>
              <strong>{order.address.fullName}</strong>
              <div>{order.address.house}, {order.address.street}{order.address.landmark ? `, near ${order.address.landmark}` : ''}</div>
              <div>{order.address.city}, {order.address.state} – {order.address.pincode}</div>
              <div>Mobile: {order.address.mobile}</div>
            </div>
            <div className="col-sm-6 text-sm-end">
              <div className="text-muted">Payment</div>
              <strong>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : PAYMENT_METHOD[order.payment?.method] || 'Online'}</strong>
              <div>{PAYMENT_STATUS[order.paymentStatus] || order.paymentStatus}</div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead><tr><th>Item</th><th>Qty</th><th className="text-end">Price</th><th className="text-end">Amount</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.sku}>
                    <td>{i.name}{i.optionLabel ? <div className="small text-muted">{i.optionLabel} · {i.sku}</div> : null}</td>
                    <td>{i.quantity}</td>
                    <td className="text-end">{formatINR(i.price)}</td>
                    <td className="text-end">{formatINR(i.price * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ms-auto small" style={{ maxWidth: 280 }}>
            <div className="d-flex justify-content-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
            <div className="d-flex justify-content-between"><span>Delivery</span><span>{order.deliveryCharge ? formatINR(order.deliveryCharge) : 'FREE'}</span></div>
            {order.codCharge > 0 && <div className="d-flex justify-content-between"><span>Cash on Delivery charge</span><span>{formatINR(order.codCharge)}</span></div>}
            <div className="d-flex justify-content-between fw-bold border-top mt-1 pt-1"><span>Total</span><span>{formatINR(order.total)}</span></div>
            {order.refundedAmount > 0 && <div className="d-flex justify-content-between text-success"><span>Refunded</span><span>{formatINR(order.refundedAmount)}</span></div>}
          </div>
          <p className="small text-muted mt-4 mb-0">Thank you for shopping with {settings.store.name}. This is an order receipt, not a tax invoice.</p>
        </div>
      )}
    </div>
  );
}
