import { Link, useSearchParams } from 'react-router-dom';
import { formatDateTime, formatINR, useApi } from '../api.js';
import { ErrorNote } from '../components/ui.jsx';

// Packing slip / order receipt for each chosen order, one per printed page (PRD §8.3)
export default function PackingSlips() {
  const [params] = useSearchParams();
  const orders = params.get('orders') || '';
  const { data, error, loading } = useApi(orders ? `/admin/orders/print?orders=${encodeURIComponent(orders)}` : null);

  return (
    <>
      <div className="no-print d-flex flex-wrap gap-2 align-items-center mb-4">
        <Link to="/orders" className="btn btn-light"><i className="bi bi-arrow-left me-1" />Orders</Link>
        <button type="button" className="btn btn-orange" disabled={!data?.orders.length} onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>
        <span className="small text-muted">{data ? `${data.orders.length} packing slip(s)` : loading ? 'Loading…' : ''}</span>
      </div>
      <ErrorNote error={error} />
      {data?.orders.map((o) => (
        <section key={o.orderNumber} className="slip">
          <div className="d-flex justify-content-between flex-wrap gap-3 mb-3">
            <div>
              <div className="h4 mb-0" style={{ fontFamily: 'Poppins, sans-serif' }}>{data.store.name}</div>
              <div className="small">{data.store.address}</div>
              <div className="small">{data.store.phone} · {data.store.email}</div>
            </div>
            <div className="text-end">
              <div className="fw-bold">PACKING SLIP</div>
              <div>Order <strong>{o.orderNumber}</strong></div>
              <div className="small">{formatDateTime(o.createdAt)}</div>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-7">
              <div className="small text-uppercase fw-bold">Deliver to</div>
              <div className="fw-semibold">{o.address.fullName}</div>
              <div>{o.address.house}, {o.address.street}{o.address.landmark ? `, near ${o.address.landmark}` : ''}</div>
              <div>{o.address.city}, {o.address.state} – {o.address.pincode}</div>
              <div>Phone: {o.address.mobile}{o.address.alternateMobile ? ` / ${o.address.alternateMobile}` : ''}</div>
            </div>
            <div className="col-sm-5 text-sm-end">
              <div className="small text-uppercase fw-bold">Payment</div>
              {o.codToCollect > 0 ? (
                <div className="cod-box">CASH ON DELIVERY: COLLECT {formatINR(o.codToCollect)}</div>
              ) : (
                <div className="fw-semibold">{o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'PREPAID: do not collect cash'}</div>
              )}
              {o.shipping?.trackingNumber && <div className="small mt-2">{o.shipping.courier} · {o.shipping.trackingNumber}</div>}
            </div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Option</th><th>SKU</th><th>Qty</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.sku}>
                  <td>{i.name}</td>
                  <td>{i.optionLabel}</td>
                  <td>{i.sku}</td>
                  <td>{i.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(i.price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 ms-auto small" style={{ maxWidth: 260 }}>
            <div className="d-flex justify-content-between"><span>Subtotal</span><span>{formatINR(o.subtotal)}</span></div>
            <div className="d-flex justify-content-between"><span>Delivery</span><span>{o.deliveryCharge ? formatINR(o.deliveryCharge) : 'FREE'}</span></div>
            {o.codCharge > 0 && <div className="d-flex justify-content-between"><span>COD charge</span><span>{formatINR(o.codCharge)}</span></div>}
            <div className="d-flex justify-content-between fw-bold"><span>Total</span><span>{formatINR(o.total)}</span></div>
          </div>
          <p className="small mt-3 mb-0">Thank you for shopping with {data.store.name}! For help, call or WhatsApp {data.store.phone}.</p>
        </section>
      ))}
    </>
  );
}
