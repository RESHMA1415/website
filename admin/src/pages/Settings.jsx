import { useEffect, useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ImageField } from '../components/MediaPicker.jsx';
import { ErrorNote, PageTitle, Panel } from '../components/ui.jsx';

const PAGES = [
  ['about', 'About Us'],
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms & Conditions'],
  ['shipping', 'Shipping Policy'],
  ['refunds', 'Refund & Cancellation Policy'],
  ['faq', 'FAQ'],
];

// One section of Business Settings with its own Save button
function Section({ title, section, initial, children, note, onSaved }) {
  const { notify } = useAuth();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => setForm(initial), [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await api(`/admin/settings/${section}`, { method: 'PUT', body: form });
      notify(`${title} saved`);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="h-100">
      <Panel
        title={title}
        actions={<button type="submit" className="btn btn-sm btn-orange" disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>}
      >
        <ErrorNote error={error} />
        {note}
        {children(form, set, setForm)}
      </Panel>
    </form>
  );
}

function Field({ id, label, value, onChange, type = 'text', prefix, hint, ...rest }) {
  return (
    <div className="col-md-6">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="input-group">
        {prefix && <span className="input-group-text">{prefix}</span>}
        <input id={id} type={type} className="form-control" value={value ?? ''} onChange={onChange} {...rest} />
      </div>
      {hint && <div className="form-text">{hint}</div>}
    </div>
  );
}

const POLICY_WARNING = (
  <div className="alert alert-warning small py-2">
    Your Refund, Shipping and Terms pages and the FAQ mention these numbers. If you change them, please update those pages too (Page Content below).
  </div>
);

function PageEditor({ pages, legalVersion, onSaved }) {
  const { notify } = useAuth();
  const [page, setPage] = useState('about');
  const [text, setText] = useState(pages.about);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setText(pages[page] || ''), [page, pages]);
  const dirty = text !== (pages[page] || '');
  const isPolicy = ['privacy', 'terms', 'refunds'].includes(page);
  const save = async () => {
    if (isPolicy && !window.confirm('Save this policy? Customers who agree from now on will be recorded against the new version.')) return;
    setBusy(true);
    setError('');
    try {
      onSaved(await api('/admin/settings/pages', { method: 'PUT', body: { page, content: text } }));
      notify('Page saved. It is live on your store now.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Page Content"
      actions={<button type="button" className="btn btn-sm btn-orange" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : dirty ? 'Save page' : 'Saved'}</button>}
    >
      <ErrorNote error={error} />
      <div className="d-flex flex-wrap gap-2 mb-3">
        {PAGES.map(([key, label]) => (
          <button key={key} type="button" className={`btn btn-sm ${page === key ? 'btn-navy' : 'btn-light'}`} onClick={() => (dirty && !window.confirm('Leave without saving your changes?') ? null : setPage(key))}>{label}</button>
        ))}
      </div>
      <p className="small text-muted">
        Formatting: a line starting with <code>## </code> is a heading, <code>- </code> a bullet point, <code>**words**</code> are bold, and <code>[text](/policies/terms)</code> is a link.
        {isPolicy && <> Policies are legal documents: the current version is <strong>{legalVersion}</strong>. Saving a change records a new version for customers who agree from now on. It’s wise to have a lawyer check changes.</>}
      </p>
      <label className="visually-hidden" htmlFor="page-text">Page text</label>
      <textarea id="page-text" className="form-control font-monospace small" rows={18} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="d-flex justify-content-between small text-muted mt-1">
        <span>{text.length.toLocaleString('en-IN')} characters</span>
        <a href={`${import.meta.env.VITE_STORE_URL || 'http://localhost:5173'}/${page === 'about' ? 'about' : `policies/${page}`}`} target="_blank" rel="noreferrer">View on store <i className="bi bi-box-arrow-up-right" /></a>
      </div>
    </Panel>
  );
}

// Business Settings (PRD §14.11)
export default function Settings() {
  const { data, error, loading } = useApi('/admin/settings');
  const [s, setS] = useState(null);
  const v = s || data;
  if (loading && !v) return <div className="text-muted">Loading settings…</div>;
  if (!v) return <ErrorNote error={error} />;
  const saved = (next) => setS(next);

  return (
    <>
      <PageTitle title="Business Settings" subtitle="Change how your store works, without touching any code. Each box saves on its own." />
      <div className="row g-3">
        <div className="col-xl-6">
          <Section title="Store Details" section="store" initial={v.store} onSaved={saved}>
            {(f, set) => (
              <div className="row g-3">
                <Field id="s-name" label="Store name *" value={f.name} onChange={set('name')} required maxLength={60} />
                <Field id="s-tagline" label="Tagline" value={f.tagline} onChange={set('tagline')} maxLength={120} />
                <Field id="s-email" label="Contact email *" type="email" value={f.email} onChange={set('email')} required />
                <Field id="s-phone" label="Phone *" value={f.phone} onChange={set('phone')} required maxLength={20} />
                <Field id="s-wa" label="WhatsApp number" value={f.whatsappNumber} onChange={set('whatsappNumber')} hint="91 followed by the 10-digit number, e.g. 919876543210" />
                <Field id="s-hours" label="Business hours" value={f.businessHours} onChange={set('businessHours')} maxLength={80} />
                <div className="col-12">
                  <label className="form-label" htmlFor="s-address">Address *</label>
                  <textarea id="s-address" className="form-control" rows={2} required maxLength={300} value={f.address || ''} onChange={set('address')} />
                </div>
                <Field id="s-maplink" label="Google Maps link (Get Directions)" value={f.mapLink} onChange={set('mapLink')} placeholder="https://…" />
                <Field id="s-mapq" label="Map search text" value={f.mapQuery} onChange={set('mapQuery')} hint="Used if there is no embed link" />
                <div className="col-12">
                  <label className="form-label" htmlFor="s-embed">Map embed link</label>
                  <input id="s-embed" className="form-control" value={f.mapEmbedUrl || ''} onChange={set('mapEmbedUrl')} placeholder="https://www.google.com/maps/embed?pb=…" />
                  <div className="form-text">Google Maps → Share → Embed a map → copy the link inside src="…".</div>
                </div>
                <div className="col-md-6"><ImageField label="Logo" value={f.logoUrl} onChange={set('logoUrl')} ratio="3 / 1" hint="Shown in the store header instead of the SHOPME text" /></div>
                <div className="col-md-6"><ImageField label="Browser tab icon" value={f.faviconUrl} onChange={set('faviconUrl')} ratio="1 / 1" hint="A small square picture" /></div>
              </div>
            )}
          </Section>
        </div>
        <div className="col-xl-6 d-flex flex-column gap-3">
          <Section title="Delivery" section="delivery" initial={v.delivery} onSaved={saved} note={POLICY_WARNING}>
            {(f, set) => (
              <div className="row g-3">
                <Field id="s-free" label="Free delivery on orders from" prefix="₹" type="number" min="0" value={f.freeDeliveryThreshold} onChange={set('freeDeliveryThreshold')} />
                <Field id="s-dc" label="Delivery charge below that" prefix="₹" type="number" min="0" value={f.deliveryCharge} onChange={set('deliveryCharge')} />
                <Field id="s-min" label="Delivery estimate: from (days)" type="number" min="1" value={f.estimateMinDays} onChange={set('estimateMinDays')} />
                <Field id="s-max" label="Delivery estimate: to (days)" type="number" min="1" value={f.estimateMaxDays} onChange={set('estimateMaxDays')} />
              </div>
            )}
          </Section>
          <Section title="Cash on Delivery" section="cod" initial={v.cod} onSaved={saved}>
            {(f, set) => (
              <>
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="s-cod" checked={Boolean(f.enabled)} onChange={set('enabled')} />
                  <label className="form-check-label" htmlFor="s-cod">Offer Cash on Delivery</label>
                </div>
                <div className="row g-3">
                  <Field id="s-codfee" label="COD extra charge" prefix="₹" type="number" min="0" value={f.charge} onChange={set('charge')} />
                  <Field id="s-codmax" label="Maximum COD order value" prefix="₹" type="number" min="1" value={f.maxOrderValue} onChange={set('maxOrderValue')} />
                </div>
              </>
            )}
          </Section>
        </div>
        <div className="col-xl-6">
          <Section title="Orders & Returns" section="orders" initial={v.orders} onSaved={saved}>
            {(f, set) => (
              <div className="row g-3">
                <Field id="s-qty" label="Max quantity per item per order" type="number" min="1" value={f.maxQtyPerItem} onChange={set('maxQtyPerItem')} />
                <Field id="s-ret" label="Return window (days after delivery)" type="number" min="0" value={f.returnWindowDays} onChange={set('returnWindowDays')} hint="Your policies say 7 days: update them if you change this" />
                <Field id="s-new" label="“New arrival” for (days)" type="number" min="1" value={f.newArrivalDays} onChange={set('newArrivalDays')} />
                <Field id="s-low" label="Low-stock alert at (default)" type="number" min="0" value={f.lowStockDefault} onChange={set('lowStockDefault')} hint="Used where a size/colour has no level of its own" />
              </div>
            )}
          </Section>
        </div>
        <div className="col-xl-6">
          <Panel title="Payments (Razorpay)">
            <div className="small">
              {v.status.razorpay.connected ? (
                <>
                  <div className="fw-semibold text-success mb-1"><i className="bi bi-check-circle-fill me-1" />Connected · {v.status.razorpay.mode === 'live' ? 'LIVE mode (real money)' : 'Test mode (no real money)'}</div>
                  <div className="text-muted">Key {v.status.razorpay.keyId}</div>
                </>
              ) : (
                <div className="fw-semibold text-danger mb-1"><i className="bi bi-x-circle-fill me-1" />Not connected: customers can only pay Cash on Delivery</div>
              )}
              <p className="text-muted mt-2 mb-0">For safety, Razorpay keys are kept in the private server settings file (backend/.env), never on this screen. Test or live mode follows the keys you put there.</p>
            </div>
          </Panel>
        </div>
        <div className="col-xl-6">
          <Section title="Emails" section="notifications" initial={v.notifications} onSaved={saved}>
            {(f, set, setForm) => {
              const toggle = (key) => setForm((x) => ({ ...x, events: { ...x.events, [key]: x.events?.[key] === false } }));
              const list = (group) => Object.entries(v.emailEvents[group]).map(([key, label]) => (
                <div key={key} className="form-check">
                  <input className="form-check-input" type="checkbox" id={`ev-${key}`} checked={f.events?.[key] !== false} onChange={() => toggle(key)} disabled={!f.emailEnabled} />
                  <label className="form-check-label small" htmlFor={`ev-${key}`}>{label}</label>
                </div>
              ));
              return (
                <>
                  {!v.status.email.connected && <div className="alert alert-warning small py-2">Emails aren’t being sent yet: add your Gmail App Password (see My Account → Store emails).</div>}
                  <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" id="s-email-on" checked={f.emailEnabled !== false} onChange={set('emailEnabled')} />
                    <label className="form-check-label" htmlFor="s-email-on">Send emails (password-reset and account emails are always sent)</label>
                  </div>
                  <div className="mb-3" style={{ maxWidth: 360 }}>
                    <label className="form-label" htmlFor="s-alert">Send alerts for you to</label>
                    <input id="s-alert" type="email" className="form-control" value={f.adminAlertEmail || ''} onChange={set('adminAlertEmail')} />
                  </div>
                  <div className="row">
                    <div className="col-md-7"><div className="fw-semibold small mb-1">Emails to customers</div>{list('customer')}</div>
                    <div className="col-md-5"><div className="fw-semibold small mb-1">Alerts to you</div>{list('admin')}</div>
                  </div>
                </>
              );
            }}
          </Section>
        </div>
        <div className="col-xl-6">
          <Section title="Social Media" section="social" initial={v.social} onSaved={saved} note={<p className="small text-muted">Paste full links starting with https://. Icons appear in the footer once a link is added.</p>}>
            {(f, set) => (
              <div className="row g-3">
                {['instagram', 'facebook', 'youtube', 'x', 'pinterest'].map((key) => (
                  <Field key={key} id={`s-${key}`} label={key === 'x' ? 'X (Twitter)' : key[0].toUpperCase() + key.slice(1)} value={f[key]} onChange={set(key)} placeholder="https://…" />
                ))}
              </div>
            )}
          </Section>
        </div>
        <div className="col-xl-6">
          <Section title="Search Engines & Sharing (SEO)" section="seo" initial={v.seo} onSaved={saved}>
            {(f, set) => (
              <>
                <div className="mb-3">
                  <label className="form-label" htmlFor="s-seo-title">Site title *</label>
                  <input id="s-seo-title" className="form-control" required maxLength={70} value={f.title || ''} onChange={set('title')} />
                  <div className="form-text">{(f.title || '').length}/70: shown in Google results and browser tabs</div>
                </div>
                <label className="form-label" htmlFor="s-seo-desc">Site description *</label>
                <textarea id="s-seo-desc" className="form-control mb-1" rows={3} required maxLength={200} value={f.description || ''} onChange={set('description')} />
                <div className="form-text mb-3">{(f.description || '').length}/200</div>
                <ImageField label="Picture when shared (WhatsApp, Facebook)" value={f.shareImageUrl} onChange={set('shareImageUrl')} ratio="1.91 / 1" />
              </>
            )}
          </Section>
        </div>
        <div className="col-12">
          <PageEditor pages={v.pages} legalVersion={v.legalVersion} onSaved={saved} />
        </div>
      </div>
    </>
  );
}
