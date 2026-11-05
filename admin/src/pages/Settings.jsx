import { useState } from 'react';
import { useApi } from '../api.js';
import { PageTitle, Panel, PhaseNotice } from '../components/ui.jsx';

function Field({ id, label, value, type = 'text', prefix, hint }) {
  return (
    <div className="col-md-6">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="input-group">
        {prefix && <span className="input-group-text">{prefix}</span>}
        <input id={id} type={type} className="form-control" defaultValue={value ?? ''} />
      </div>
      {hint && <div className="form-text">{hint}</div>}
    </div>
  );
}

export default function Settings() {
  const { data: s, loading } = useApi('/settings');
  const [saved, setSaved] = useState(false);

  if (loading || !s) return <div className="text-muted">Loading settings…</div>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
    >
      <PageTitle
        title="Business Settings"
        subtitle="Change how your store works, without touching any code"
        actions={<button type="submit" className="btn btn-orange"><i className="bi bi-check-lg me-1" />Save Settings</button>}
      />
      <PhaseNotice phase={8}>
        These are your current settings. Saving changes from this screen starts working in Phase 8.
      </PhaseNotice>
      {saved && <div className="alert alert-warning small">Saving settings starts working in Phase 8.</div>}

      <div className="row g-3">
        <div className="col-xl-6">
          <Panel title="Store Details">
            <div className="row g-3">
              <Field id="s-name" label="Store name" value={s.store.name} />
              <Field id="s-email" label="Contact email" value={s.store.email} type="email" />
              <Field id="s-phone" label="Phone" value={s.store.phone} />
              <Field id="s-wa" label="WhatsApp number" value={s.store.whatsappNumber} hint="With country code, e.g. 919876543210" />
              <Field id="s-hours" label="Business hours" value={s.store.businessHours} />
              <div className="col-12">
                <label className="form-label" htmlFor="s-address">Address</label>
                <textarea id="s-address" className="form-control" rows={2} defaultValue={s.store.address} />
              </div>
            </div>
          </Panel>
        </div>
        <div className="col-xl-6">
          <div className="d-flex flex-column gap-3">
            <Panel title="Delivery">
              <div className="row g-3">
                <Field id="s-free" label="Free delivery on orders from" prefix="₹" type="number" value={s.delivery.freeDeliveryThreshold} />
                <Field id="s-dc" label="Delivery charge below that" prefix="₹" type="number" value={s.delivery.deliveryCharge} />
                <Field id="s-min" label="Delivery estimate: from (days)" type="number" value={s.delivery.estimateMinDays} />
                <Field id="s-max" label="Delivery estimate: to (days)" type="number" value={s.delivery.estimateMaxDays} />
              </div>
            </Panel>
            <Panel title="Cash on Delivery">
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="s-cod" defaultChecked={s.cod.enabled} />
                <label className="form-check-label" htmlFor="s-cod">Offer Cash on Delivery</label>
              </div>
              <div className="row g-3">
                <Field id="s-codfee" label="COD extra charge" prefix="₹" type="number" value={s.cod.charge} />
                <Field id="s-codmax" label="Maximum COD order value" prefix="₹" type="number" value={s.cod.maxOrderValue} />
              </div>
            </Panel>
          </div>
        </div>
        <div className="col-xl-6">
          <Panel title="Orders & Returns">
            <div className="row g-3">
              <Field id="s-qty" label="Max quantity per item per order" type="number" value={s.orders.maxQtyPerItem} />
              <Field id="s-ret" label="Return window (days after delivery)" type="number" value={s.orders.returnWindowDays} />
            </div>
          </Panel>
        </div>
        <div className="col-xl-6">
          <Panel title="Social Media">
            <div className="row g-3">
              {['instagram', 'facebook', 'youtube', 'x', 'pinterest'].map((key) => (
                <Field key={key} id={`s-${key}`} label={key === 'x' ? 'X (Twitter)' : key[0].toUpperCase() + key.slice(1)} value={s.social[key]} />
              ))}
            </div>
          </Panel>
        </div>
        <div className="col-xl-6">
          <Panel title="Payments (Razorpay)">
            <p className="small text-muted">
              Your Razorpay keys are kept in the secure server settings, never on this screen. They are connected in Phase 4.
            </p>
            <div className="d-flex gap-3">
              <div className="form-check"><input className="form-check-input" type="radio" name="rzp" id="rzp-test" defaultChecked /><label className="form-check-label" htmlFor="rzp-test">Test mode</label></div>
              <div className="form-check"><input className="form-check-input" type="radio" name="rzp" id="rzp-live" /><label className="form-check-label" htmlFor="rzp-live">Live mode</label></div>
            </div>
          </Panel>
        </div>
        <div className="col-xl-6">
          <Panel title="Search Engine (SEO)">
            <div className="mb-3">
              <label className="form-label" htmlFor="s-seo-title">Site title</label>
              <input id="s-seo-title" className="form-control" defaultValue={s.seo?.title} />
            </div>
            <label className="form-label" htmlFor="s-seo-desc">Site description</label>
            <textarea id="s-seo-desc" className="form-control" rows={3} defaultValue={s.seo?.description} />
          </Panel>
        </div>
        <div className="col-12">
          <Panel title="Page Content">
            <p className="small text-muted mb-2">Edit About Us, policies and FAQ text shown on your store.</p>
            <div className="d-flex flex-wrap gap-2">
              {['About Us', 'Privacy Policy', 'Terms & Conditions', 'Shipping Policy', 'Refund & Cancellation Policy', 'FAQ'].map((p) => (
                <button key={p} type="button" className="btn btn-sm btn-light" disabled>{p}</button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </form>
  );
}
