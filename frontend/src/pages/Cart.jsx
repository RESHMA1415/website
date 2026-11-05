import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useShopper } from '../context/ShopperContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';

// Totals always come from the server (`summary` from the cart). `codCharge` is
// only for showing the Cash on Delivery fee once a payment method is picked.
export function OrderSummary({ summary, codCharge = 0, estimate = true, children }) {
  const { settings } = useStore();
  const s = summary || { subtotal: 0, deliveryCharge: 0, savings: 0, total: 0, amountForFreeDelivery: 0 };
  const threshold = s.freeDeliveryThreshold ?? settings.delivery.freeDeliveryThreshold;
  const total = s.total + codCharge;

  return (
    <div className="card-soft p-4">
      <h2 className="h5 mb-3">Order Summary</h2>
      {s.amountForFreeDelivery > 0 && (
        <div className="mb-3">
          <div className="small mb-1">
            Add <strong className="text-orange">{formatINR(s.amountForFreeDelivery)}</strong> more to get <strong>FREE delivery!</strong>
          </div>
          <div className="delivery-progress"><div style={{ width: `${Math.min(100, (s.subtotal / threshold) * 100)}%` }} /></div>
        </div>
      )}
      <div className="d-flex justify-content-between mb-2"><span>Subtotal</span><span>{formatINR(s.subtotal)}</span></div>
      <div className="d-flex justify-content-between mb-2">
        <span>Delivery</span>
        <span>{s.subtotal > 0 && s.deliveryCharge === 0 ? <span className="text-success fw-semibold">FREE</span> : formatINR(s.deliveryCharge)}</span>
      </div>
      {codCharge > 0 && <div className="d-flex justify-content-between mb-2"><span>Cash on Delivery charge</span><span>{formatINR(codCharge)}</span></div>}
      {s.savings > 0 && <div className="d-flex justify-content-between mb-2 text-success"><span>You save</span><span>{formatINR(s.savings)}</span></div>}
      <hr />
      <div className="d-flex justify-content-between fw-bold fs-5 text-navy mb-2"><span>{estimate ? 'Estimated Total' : 'Total'}</span><span>{formatINR(total)}</span></div>
      {settings.cod.enabled && codCharge === 0 && (
        <div className="small text-muted">A {formatINR(settings.cod.charge)} charge applies if you choose Cash on Delivery.</div>
      )}
      {children}
    </div>
  );
}

function QuantityControl({ line, onChange, disabled }) {
  const atMax = line.quantity >= line.maxQuantity;
  return (
    <div className="qty-control qty-sm" aria-label={`Quantity for ${line.name}`}>
      <button type="button" aria-label="Decrease quantity" disabled={disabled || line.quantity <= 1} onClick={() => onChange(line.quantity - 1)}>−</button>
      <span>{line.quantity}</span>
      <button type="button" aria-label="Increase quantity" disabled={disabled || atMax} onClick={() => onChange(line.quantity + 1)} title={atMax ? `Only ${line.maxQuantity} available` : undefined}>+</button>
    </div>
  );
}

function CartLine({ line }) {
  const { notify } = useStore();
  const { user, updateCartItem, removeCartItem, moveToWishlist, goToLogin } = useShopper();
  const [busy, setBusy] = useState(false);
  const run = async (action, message) => {
    setBusy(true);
    try {
      await action();
      if (message) notify(message);
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };
  const unavailable = line.status === 'unavailable';
  const url = line.slug ? `/product/${line.slug}` : null;

  return (
    <div className={`cart-line ${line.status !== 'ok' ? 'has-warning' : ''}`}>
      <div className="cart-line-image">
        {line.imageUrl ? <img src={line.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}
      </div>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex justify-content-between gap-2">
          <div style={{ minWidth: 0 }}>
            {line.brand && <div className="small text-muted text-uppercase">{line.brand}</div>}
            {url ? <Link to={url} className="fw-semibold text-navy d-block text-truncate">{line.name}</Link> : <span className="fw-semibold">{line.name}</span>}
            {line.optionLabel && <div className="small text-muted">{line.optionLabel}</div>}
          </div>
          {!unavailable && <div className="fw-bold text-navy text-nowrap">{formatINR(line.lineTotal)}</div>}
        </div>
        {!unavailable && (
          <div className="small mt-1">
            <span className="fw-semibold">{formatINR(line.price)}</span>
            {line.mrp > line.price && <span className="text-muted text-decoration-line-through ms-2">{formatINR(line.mrp)}</span>}
            {line.discountPercent > 0 && <span className="text-success ms-2">{line.discountPercent}% OFF</span>}
          </div>
        )}
        {line.priceChanged && (
          <div className="small text-orange mt-1">
            <i className="bi bi-info-circle me-1" />
            Price {line.priceChanged.to < line.priceChanged.from ? 'dropped' : 'changed'} from {formatINR(line.priceChanged.from)} to {formatINR(line.priceChanged.to)} since you added it.
          </div>
        )}
        {line.message && <div className="small text-danger fw-semibold mt-1"><i className="bi bi-exclamation-triangle me-1" />{line.message}</div>}
        <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
          {!unavailable && line.status !== 'out_of_stock' && <QuantityControl line={line} disabled={busy} onChange={(q) => run(() => updateCartItem(line._id, q))} />}
          {line.status === 'limited' && line.maxQuantity > 0 && (
            <button type="button" className="btn btn-sm btn-outline-navy" disabled={busy} onClick={() => run(() => updateCartItem(line._id, line.maxQuantity), `Quantity set to ${line.maxQuantity}`)}>
              Set to {line.maxQuantity}
            </button>
          )}
          <button type="button" className="btn btn-link btn-sm p-0 text-danger" disabled={busy} onClick={() => run(() => removeCartItem(line._id), 'Removed from your cart')}>
            <i className="bi bi-trash me-1" />Remove
          </button>
          {!unavailable && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              disabled={busy}
              onClick={() => (user ? run(() => moveToWishlist(line._id), 'Moved to your wishlist') : goToLogin('Please log in to save items to your wishlist.'))}
            >
              <i className="bi bi-heart me-1" />Move to wishlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  const { cart, user, goToLogin } = useShopper();
  const navigate = useNavigate();
  const { items, summary, canCheckout, count } = cart;
  const problems = items.filter((i) => i.status !== 'ok').length;

  const checkout = () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent('/checkout')}`);
      return;
    }
    navigate('/checkout');
  };

  return (
    <>
      <PageHeader title="Shopping Cart" crumbs={[{ label: 'Cart' }]}>
        {count > 0 && <p className="text-muted mb-0 mt-1">{count} item{count === 1 ? '' : 's'}</p>}
      </PageHeader>
      <div className="container">
        {items.length === 0 ? (
          <div className="card-soft">
            <EmptyState icon="bi-bag" title="Your cart is empty" text="Looks like you haven’t added anything yet." actionLabel="Shop Now" />
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-8">
              {problems > 0 && (
                <div className="alert alert-warning small" role="alert">
                  <i className="bi bi-exclamation-triangle me-2" />
                  {problems === 1 ? 'One item needs' : `${problems} items need`} your attention before you can check out.
                </div>
              )}
              <div className="card-soft">
                {items.map((line) => <CartLine key={line._id} line={line} />)}
              </div>
            </div>
            <div className="col-lg-4">
              <OrderSummary summary={summary}>
                <button type="button" className="btn btn-orange w-100 mt-3" disabled={!canCheckout} onClick={checkout}>
                  Proceed to Checkout
                </button>
                {!user && canCheckout && (
                  <div className="small text-muted text-center mt-2">
                    You’ll be asked to <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => goToLogin()}>log in</button> or create an account. Your cart is kept.
                  </div>
                )}
                <Link to="/shop" className="btn btn-link w-100 mt-1">Continue Shopping</Link>
              </OrderSummary>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
