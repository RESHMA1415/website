import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const { settings } = useStore();
  return (
    <div className="container py-5 text-center" style={{ maxWidth: 620 }}>
      <div className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 84, height: 84, background: '#e8f6ee' }}>
        <i className="bi bi-check-lg text-success" style={{ fontSize: '2.8rem' }} />
      </div>
      <h1 className="h2">Thank you for your order!</h1>
      <p className="text-muted">
        Your order <strong className="text-navy">{orderNumber}</strong> is confirmed. We’ve sent the details to your
        email and WhatsApp.
      </p>
      <div className="card-soft p-4 my-4 text-start">
        <div className="d-flex justify-content-between mb-2"><span className="text-muted">Order number</span><strong>{orderNumber}</strong></div>
        <div className="d-flex justify-content-between">
          <span className="text-muted">Expected delivery</span>
          <strong>{settings.delivery.estimateMinDays}–{settings.delivery.estimateMaxDays} business days</strong>
        </div>
      </div>
      <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
        <Link to={`/account/orders/${orderNumber}`} className="btn btn-navy">Track Order</Link>
        <Link to="/shop" className="btn btn-outline-navy">Continue Shopping</Link>
      </div>
    </div>
  );
}
