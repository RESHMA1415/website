import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import EmptyState from '../../components/EmptyState.jsx';
import { formatDate, formatINR } from '../../utils/format.js';
import { StatusBadge } from '../../utils/orders.jsx';
import AccountLayout from './AccountLayout.jsx';

// My Orders, newest first (PRD §13.11)
export default function Orders() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders?page=${page}`).then(setData).catch((err) => setError(err.message));
  }, [page]);

  return (
    <AccountLayout title="My Orders" crumbs={[{ label: 'Orders' }]}>
      {error && <div className="alert alert-danger">{error}</div>}
      {!data && !error && <div className="card-soft p-4 text-muted">Loading your orders…</div>}
      {data && data.items.length === 0 && (
        <div className="card-soft">
          <EmptyState
            icon="bi-box-seam"
            title="No orders yet"
            text="When you place an order, you can track it, cancel it before shipping, or request a return here."
            actionLabel="Start Shopping"
          />
        </div>
      )}
      {data?.items.map((order) => (
        <Link key={order.orderNumber} to={`/account/orders/${order.orderNumber}`} className="card-soft p-3 p-md-4 mb-3 d-block order-card">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <div>
              <div className="fw-semibold text-navy">{order.orderNumber}</div>
              <div className="small text-muted">Placed on {formatDate(order.createdAt)}</div>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="d-flex align-items-center gap-2 mb-2">
            {order.items.slice(0, 4).map((item, i) => (
              <div key={i} className="cart-line-image" style={{ width: 48, height: 60 }}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}
              </div>
            ))}
            {order.items.length > 4 && <span className="small text-muted">+{order.items.length - 4} more</span>}
          </div>
          <div className="d-flex justify-content-between small">
            <span className="text-muted">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'} · {order.items.reduce((s, i) => s + i.quantity, 0)} item(s)</span>
            <span className="fw-bold text-navy">{formatINR(order.total)}</span>
          </div>
        </Link>
      ))}
      {data?.pages > 1 && (
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
          <span className="small align-self-center">Page {page} of {data.pages}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Older</button>
        </div>
      )}
    </AccountLayout>
  );
}
