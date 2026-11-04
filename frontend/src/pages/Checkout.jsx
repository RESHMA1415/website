import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddressForm from '../components/AddressForm.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PhaseNotice from '../components/PhaseNotice.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';
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

export default function Checkout() {
  const { settings } = useStore();
  const [method, setMethod] = useState('online');

  return (
    <>
      <PageHeader title="Checkout" crumbs={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <div className="container">
        <PhaseNotice phase={4}>
          This shows the checkout layout and fields. Placing orders and Razorpay payments start working in Phase 4.
        </PhaseNotice>
        <div className="row g-4">
          <div className="col-lg-8">
            <Step number={1} title="Delivery Address">
              <p className="small text-muted">Saved addresses appear here after you log in.</p>
              <AddressForm idPrefix="checkout" />
              <div className="form-check mt-3">
                <input className="form-check-input" type="checkbox" id="save-address" defaultChecked />
                <label className="form-check-label" htmlFor="save-address">Save this address for next time</label>
              </div>
            </Step>

            <Step number={2} title="Payment Method">
              {[
                { value: 'online', title: 'Pay Online', text: 'UPI, Debit/Credit Card, Net Banking, Wallets (secured by Razorpay)', icon: 'bi-credit-card' },
                settings.cod.enabled && {
                  value: 'cod',
                  title: `Cash on Delivery (+${formatINR(settings.cod.charge)})`,
                  text: `Pay in cash when your order arrives. Available on orders up to ${formatINR(settings.cod.maxOrderValue)}.`,
                  icon: 'bi-cash-coin',
                },
              ]
                .filter(Boolean)
                .map((option) => (
                  <label key={option.value} className={`d-flex gap-3 p-3 rounded-3 border mb-2 ${method === option.value ? 'border-warning bg-soft' : ''}`} style={{ cursor: 'pointer' }}>
                    <input type="radio" className="form-check-input mt-1" name="payment" checked={method === option.value} onChange={() => setMethod(option.value)} />
                    <i className={`bi ${option.icon} fs-4 text-orange`} />
                    <span>
                      <span className="fw-semibold d-block">{option.title}</span>
                      <span className="small text-muted">{option.text}</span>
                    </span>
                  </label>
                ))}
            </Step>

            <Step number={3} title="Review & Place Order">
              <p className="small text-muted mb-3">Your items and final price appear here.</p>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="agree" />
                <label className="form-check-label small" htmlFor="agree">
                  I agree to the <Link to="/policies/terms">Terms & Conditions</Link> and{' '}
                  <Link to="/policies/returns">Return Policy</Link>
                </label>
              </div>
            </Step>
          </div>
          <div className="col-lg-4">
            <OrderSummary codCharge={method === 'cod' ? settings.cod.charge : 0}>
              <button type="button" className="btn btn-orange w-100 mt-3" disabled>
                {method === 'cod' ? 'Place Order' : 'Pay Now'}
              </button>
              <div className="small text-muted text-center mt-2"><i className="bi bi-lock me-1" />Secure checkout</div>
            </OrderSummary>
          </div>
        </div>
      </div>
    </>
  );
}
