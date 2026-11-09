import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import OrderTimeline from '../components/OrderTimeline.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ReturnProgress from '../components/ReturnProgress.jsx';
import TrackingCard from '../components/TrackingCard.jsx';
import { useShopper } from '../context/ShopperContext.jsx';
import { formatDate, formatINR } from '../utils/format.js';
import { StatusBadge } from '../utils/orders.jsx';

// Public order tracking with order number + mobile/email (PRD §13.12)
export default function TrackOrder() {
  const { user } = useShopper();
  const [form, setForm] = useState({ orderNumber: '', contact: '' });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setOrder(await api('/track', { method: 'POST', body: form }));
    } catch (err) {
      setOrder(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Track Your Order" crumbs={[{ label: 'Track Order' }]} />
      <div className="container" style={{ maxWidth: 760 }}>
        <form className="card-soft p-4 mb-4" onSubmit={submit}>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="t-order">Order number</label>
              <input id="t-order" className="form-control" placeholder="e.g. SHM-261103-0042" required maxLength={30} value={form.orderNumber} onChange={set('orderNumber')} />
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor="t-contact">Mobile number or email</label>
              <input id="t-contact" className="form-control" required maxLength={120} placeholder="Used when ordering" value={form.contact} onChange={set('contact')} />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? '…' : 'Track'}</button>
            </div>
          </div>
          {user && <p className="small text-muted mt-3 mb-0">Logged in? All your orders are in <Link to="/account/orders">My Orders</Link>.</p>}
        </form>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {order && (
          <div className="card-soft p-4 mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
              <div>
                <div className="fw-semibold text-navy">{order.orderNumber}</div>
                <div className="small text-muted">Placed {formatDate(order.createdAt)} · {formatINR(order.total)} · {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}{order.deliveryCity ? ` · to ${order.deliveryCity}` : ''}</div>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="small mb-4">
              {order.items.map((i, n) => <div key={n}>{i.name}{i.optionLabel ? ` (${i.optionLabel})` : ''} × {i.quantity}</div>)}
            </div>
            {order.status === 'cancelled' ? (
              <div className="alert alert-light small">This order was cancelled on {formatDate(order.cancellation?.at)}.{order.cancellation?.reason ? ` Reason: ${order.cancellation.reason}` : ''}</div>
            ) : (
              <>
                <OrderTimeline history={order.statusHistory} />
                <TrackingCard shipping={order.shipping} />
              </>
            )}
            {order.returns?.length > 0 && (
              <div className="mt-4">
                <h2 className="h6">Returns & exchanges</h2>
                <ReturnProgress returns={order.returns} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
