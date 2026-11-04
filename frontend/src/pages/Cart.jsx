import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PhaseNotice from '../components/PhaseNotice.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';

export function OrderSummary({ subtotal = 0, deliveryCharge = 0, codCharge = 0, savings = 0, children }) {
  const { settings } = useStore();
  const total = subtotal + deliveryCharge + codCharge;
  const threshold = settings.delivery.freeDeliveryThreshold;
  const remaining = Math.max(0, threshold - subtotal);

  return (
    <div className="card-soft p-4">
      <h2 className="h5 mb-3">Order Summary</h2>
      {subtotal > 0 && remaining > 0 && (
        <div className="mb-3">
          <div className="small mb-1">
            Add <strong className="text-orange">{formatINR(remaining)}</strong> more to get <strong>FREE delivery!</strong>
          </div>
          <div className="delivery-progress"><div style={{ width: `${(subtotal / threshold) * 100}%` }} /></div>
        </div>
      )}
      <div className="d-flex justify-content-between mb-2"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
      <div className="d-flex justify-content-between mb-2">
        <span>Delivery</span>
        <span>{subtotal > 0 && deliveryCharge === 0 ? <span className="text-success fw-semibold">FREE</span> : formatINR(deliveryCharge)}</span>
      </div>
      {codCharge > 0 && <div className="d-flex justify-content-between mb-2"><span>Cash on Delivery charge</span><span>{formatINR(codCharge)}</span></div>}
      {savings > 0 && <div className="d-flex justify-content-between mb-2 text-success"><span>You save</span><span>{formatINR(savings)}</span></div>}
      <hr />
      <div className="d-flex justify-content-between fw-bold fs-5 text-navy mb-2"><span>Total</span><span>{formatINR(total)}</span></div>
      {settings.cod.enabled && codCharge === 0 && (
        <div className="small text-muted">A {formatINR(settings.cod.charge)} charge applies if you choose Cash on Delivery.</div>
      )}
      {children}
    </div>
  );
}

export default function Cart() {
  return (
    <>
      <PageHeader title="Shopping Cart" crumbs={[{ label: 'Cart' }]} />
      <div className="container">
        <PhaseNotice phase={3}>Adding products to the cart starts working in Phase 3.</PhaseNotice>
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card-soft">
              <EmptyState icon="bi-bag" title="Your cart is empty" text="Looks like you haven’t added anything yet." actionLabel="Shop Now" />
            </div>
          </div>
          <div className="col-lg-4">
            <OrderSummary>
              <button type="button" className="btn btn-orange w-100 mt-3" disabled>
                Proceed to Checkout
              </button>
              <Link to="/shop" className="btn btn-link w-100 mt-1">Continue Shopping</Link>
            </OrderSummary>
          </div>
        </div>
      </div>
    </>
  );
}
