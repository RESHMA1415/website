import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import PhaseNotice from '../../components/PhaseNotice.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDate, formatINR, whatsappLink } from '../../utils/format.js';
import { PAYMENT_METHOD, PAYMENT_STATUS, StatusBadge } from '../../utils/orders.jsx';
import AccountLayout from './AccountLayout.jsx';

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${orderNumber}`).then(setOrder).catch((err) => setError(err.message));
  }, [orderNumber]);

  return (
    <AccountLayout title={`Order ${orderNumber}`} crumbs={[{ label: 'Orders', to: '/account/orders' }, { label: orderNumber }]}>
      {error && <div className="alert alert-danger">{error} <Link to="/account/orders">Back to My Orders</Link></div>}
      {!order && !error && <div className="card-soft p-4 text-muted">Loading your order…</div>}
      {order && (
        <div className="row g-4">
          <div className="col-md-7">
            <div className="card-soft p-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
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
              <PhaseNotice phase={5}>Cancelling, returns/exchanges, reviews and receipts are added in the next phases.</PhaseNotice>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-navy btn-sm" disabled>Cancel Order</button>
                <button type="button" className="btn btn-outline-navy btn-sm" disabled>Return / Exchange</button>
                <button type="button" className="btn btn-outline-navy btn-sm" disabled>Write a Review</button>
                <button type="button" className="btn btn-outline-navy btn-sm" disabled>Download Receipt</button>
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
            </div>
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
                <OrderTimeline history={order.statusHistory} />
              )}
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
