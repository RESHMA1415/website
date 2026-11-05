import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import AddressForm, { EMPTY_ADDRESS } from '../components/AddressForm.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useShopper } from '../context/ShopperContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';
import { openRazorpay } from '../utils/razorpay.js';
import { OrderSummary } from './Cart.jsx';

function Step({ number, title, children }) {
  return (
    <div className="card-soft p-4 mb-3">
      <h2 className="h5 d-flex align-items-center gap-2 mb-3">
        <span className="badge rounded-pill bg-navy">{number}</span> {title}
      </h2>
      {children}
    </div>
  );
}

const addressLine = (a) => `${a.house}, ${a.street}${a.landmark ? `, near ${a.landmark}` : ''}, ${a.city}, ${a.state} – ${a.pincode}`;

// Shown when the Razorpay window was closed or the payment failed (PRD §9.2 step 6)
function PaymentFailed({ orderNumber, reason, onRetry, busy }) {
  return (
    <div className="container py-5" style={{ maxWidth: 620 }}>
      <div className="card-soft p-4 p-md-5 text-center">
        <div className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 72, height: 72, background: '#fdecec' }}>
          <i className="bi bi-x-lg text-danger" style={{ fontSize: '2rem' }} />
        </div>
        <h1 className="h4">Payment not completed</h1>
        <p className="text-muted">
          Payment failed. No money was taken. If money was deducted, it will be refunded automatically by your bank in 5–7 days.
        </p>
        {reason && <p className="small text-muted">Reason: {reason}</p>}
        <p className="small">Your order <strong>{orderNumber}</strong> is saved for 30 minutes, and your cart is kept.</p>
        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center mt-3">
          <button type="button" className="btn btn-orange" onClick={onRetry} disabled={busy}>{busy ? 'Opening…' : 'Retry Payment'}</button>
          <Link to="/cart" className="btn btn-outline-navy">Back to Cart</Link>
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { notify } = useStore();
  const { loadCart } = useShopper();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [method, setMethod] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null); // { orderNumber, reason }

  const load = useCallback(async () => {
    try {
      const next = await api('/checkout');
      setData(next);
      setAddressId((current) => current || (next.addresses.find((a) => a.isDefault) || next.addresses[0])?._id || 'new');
      setMethod((current) => {
        if (current === 'online' && next.payment.onlineAvailable) return current;
        if (current === 'cod' && next.payment.codEnabled && next.payment.codAllowed) return current;
        if (next.payment.onlineAvailable) return 'online';
        return next.payment.codEnabled && next.payment.codAllowed ? 'cod' : '';
      });
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const finish = async (orderNumber) => {
    await loadCart();
    navigate(`/order-confirmation/${orderNumber}`, { replace: true });
  };

  // Opens Razorpay, then lets the server check the payment before confirming
  const pay = async (start) => {
    const result = await openRazorpay(start.razorpay);
    if (result.paid) {
      setBusy(true);
      try {
        await api('/payments/verify', {
          method: 'POST',
          body: { razorpayOrderId: result.paid.razorpay_order_id, razorpayPaymentId: result.paid.razorpay_payment_id, signature: result.paid.razorpay_signature },
        });
      } catch (err) {
        // The backup confirmation from Razorpay may still confirm it; the order page shows the outcome
        notify(err.message);
      }
      await finish(start.orderNumber);
      return;
    }
    await api('/payments/failed', { method: 'POST', body: { razorpayOrderId: start.razorpay.orderId, reason: result.reason } }).catch(() => {});
    setFailed({ orderNumber: start.orderNumber, reason: result.reason });
    setBusy(false);
  };

  const placeOrder = async () => {
    setError('');
    if (!method) return setError('Please choose a payment method.');
    if (!agree) return setError('Please agree to the Terms & Conditions and Return Policy.');
    const body = { paymentMethod: method, agreeTerms: true };
    if (addressId === 'new') {
      const form = document.getElementById('checkout-address');
      if (form && !form.reportValidity()) return undefined;
      Object.assign(body, { address: newAddress, saveAddress });
    } else {
      body.addressId = addressId;
    }
    setBusy(true);
    try {
      const start = await api('/orders', { method: 'POST', body });
      if (start.paymentMethod === 'cod') {
        await finish(start.orderNumber);
        return undefined;
      }
      await pay(start);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      if (err.status === 409) load(); // stock or prices changed: show the latest
    }
    return undefined;
  };

  const retry = async () => {
    setBusy(true);
    try {
      const start = await api(`/orders/${failed.orderNumber}/retry-payment`, { method: 'POST' });
      setFailed(null);
      await pay(start);
    } catch (err) {
      notify(err.message);
      setBusy(false);
      if (err.status === 410 || err.status === 409) setFailed(null);
    }
  };

  if (failed) return <PaymentFailed {...failed} onRetry={retry} busy={busy} />;
  if (loadError) return <div className="container py-5"><div className="alert alert-danger">{loadError}</div></div>;
  if (!data) return <div className="container py-5 text-center text-muted">Loading checkout…</div>;

  const { cart, addresses, totals, payment, delivery } = data;
  if (!cart.items.length) {
    return (
      <div className="container">
        <EmptyState icon="bi-bag" title="Your cart is empty" text="Add something you love, then come back to check out." actionLabel="Shop Now" />
      </div>
    );
  }
  const codExtra = totals.cod.total - totals.online.total;
  const payable = method === 'cod' ? totals.cod.total : totals.online.total;

  return (
    <>
      <PageHeader title="Checkout" crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <div className="container">
        {!cart.canCheckout && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2" />
            Some items in your cart need attention (sold out, low stock or no longer available). <Link to="/cart" className="fw-semibold">Review your cart</Link>
          </div>
        )}
        <div className="row g-4">
          <div className="col-lg-8">
            <Step number={1} title="Delivery Address">
              {addresses.map((a) => (
                <label key={a._id} className={`d-flex gap-3 p-3 rounded-3 border mb-2 checkout-option ${addressId === a._id ? 'selected' : ''}`}>
                  <input type="radio" className="form-check-input mt-1" name="address" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                  <span className="small">
                    <span className="fw-semibold d-block text-navy">
                      {a.fullName} <span className="badge rounded-pill text-bg-light text-uppercase ms-1">{a.type}</span>
                    </span>
                    {addressLine(a)}
                    <span className="d-block text-muted">Mobile: {a.mobile}</span>
                  </span>
                </label>
              ))}
              {addresses.length > 0 && (
                <label className={`d-flex gap-3 p-3 rounded-3 border mb-2 checkout-option ${addressId === 'new' ? 'selected' : ''}`}>
                  <input type="radio" className="form-check-input mt-1" name="address" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                  <span className="fw-semibold"><i className="bi bi-plus-lg me-1" />Deliver to a new address</span>
                </label>
              )}
              {addressId === 'new' && (
                <form id="checkout-address" className="mt-3" onSubmit={(e) => e.preventDefault()}>
                  <AddressForm idPrefix="checkout" value={newAddress} onChange={setNewAddress} />
                  <div className="form-check mt-3">
                    <input className="form-check-input" type="checkbox" id="save-address" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                    <label className="form-check-label" htmlFor="save-address">Save this address for next time</label>
                  </div>
                </form>
              )}
            </Step>

            <Step number={2} title="Payment Method">
              <label className={`d-flex gap-3 p-3 rounded-3 border mb-2 checkout-option ${method === 'online' ? 'selected' : ''} ${payment.onlineAvailable ? '' : 'disabled'}`}>
                <input type="radio" className="form-check-input mt-1" name="payment" checked={method === 'online'} disabled={!payment.onlineAvailable} onChange={() => setMethod('online')} />
                <i className="bi bi-credit-card fs-4 text-orange" />
                <span>
                  <span className="fw-semibold d-block">Pay Online</span>
                  <span className="small text-muted">
                    {payment.onlineAvailable ? 'UPI, Debit/Credit Card, Net Banking, Wallets (secured by Razorpay)' : 'Online payment is coming soon. Please use Cash on Delivery for now.'}
                  </span>
                </span>
              </label>
              {payment.codEnabled && (
                <label className={`d-flex gap-3 p-3 rounded-3 border mb-2 checkout-option ${method === 'cod' ? 'selected' : ''} ${payment.codAllowed ? '' : 'disabled'}`}>
                  <input type="radio" className="form-check-input mt-1" name="payment" checked={method === 'cod'} disabled={!payment.codAllowed} onChange={() => setMethod('cod')} />
                  <i className="bi bi-cash-coin fs-4 text-orange" />
                  <span>
                    <span className="fw-semibold d-block">Cash on Delivery (+{formatINR(payment.codCharge)})</span>
                    <span className="small text-muted">
                      {payment.codAllowed
                        ? 'Pay in cash when your order arrives.'
                        : `Available on orders up to ${formatINR(payment.codMaxOrderValue)}. Please pay online for this order.`}
                    </span>
                  </span>
                </label>
              )}
              {!payment.onlineAvailable && !(payment.codEnabled && payment.codAllowed) && (
                <div className="alert alert-warning small mb-0">Sorry, no payment method is available for this order right now. Please contact us on WhatsApp.</div>
              )}
            </Step>

            <Step number={3} title="Review & Place Order">
              {cart.items.map((item) => (
                <div key={item._id} className="d-flex gap-3 align-items-center mb-3">
                  <div className="cart-line-image" style={{ width: 56, height: 70 }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}
                  </div>
                  <div className="flex-grow-1 small" style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-truncate">{item.name}</div>
                    <div className="text-muted">{item.optionLabel}{item.optionLabel ? ' · ' : ''}Qty {item.quantity}</div>
                    {item.message && <div className="text-danger">{item.message}</div>}
                  </div>
                  <div className="fw-semibold text-nowrap">{formatINR(item.lineTotal ?? 0)}</div>
                </div>
              ))}
              <div className="small text-muted mb-3">
                <i className="bi bi-truck me-1" />Delivery in {delivery.minDays}–{delivery.maxDays} business days, anywhere in India.
              </div>
              <ConsentCheckbox id="agree" purpose="order" checked={agree} onChange={setAgree} className="mb-0" />
            </Step>
          </div>
          <div className="col-lg-4">
            <OrderSummary summary={totals.online} codCharge={method === 'cod' ? codExtra : 0} estimate={false}>
              {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
              <button type="button" className="btn btn-orange w-100 mt-3" disabled={busy || !cart.canCheckout || !method} onClick={placeOrder}>
                {busy ? 'Please wait…' : method === 'cod' ? 'Place Order' : `Pay ${formatINR(payable)}`}
              </button>
              <div className="small text-muted text-center mt-2"><i className="bi bi-lock me-1" />Secure checkout. Prices are confirmed by our server.</div>
            </OrderSummary>
          </div>
        </div>
      </div>
    </>
  );
}
