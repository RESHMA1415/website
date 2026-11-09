import { useState } from 'react';
import { api } from '../api/client.js';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StoreMap, { DirectionsButton } from '../components/StoreMap.jsx';
import { useShopper } from '../context/ShopperContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { generalWhatsappMessage, whatsappLink } from '../utils/format.js';

export default function Contact() {
  const { settings } = useStore();
  const { user } = useShopper();
  const { store } = settings;
  const blank = { name: user?.name || '', email: user?.email || '', mobile: user?.mobile || '', orderNumber: '', subject: '', message: '', agree: false };
  const [form, setForm] = useState(blank);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/contact', { method: 'POST', body: form });
      setSent(true);
      setForm(blank);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const details = [
    { icon: 'bi-telephone', label: 'Phone', value: store.phone },
    { icon: 'bi-envelope', label: 'Email', value: store.email },
    { icon: 'bi-geo-alt', label: 'Address', value: store.address },
    { icon: 'bi-clock', label: 'Business hours', value: store.businessHours },
  ];

  return (
    <>
      <PageHeader title="Contact Us" crumbs={[{ label: 'Contact Us' }]}>
        <p className="text-muted mb-0 mt-1">We usually reply within one business day.</p>
      </PageHeader>
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card-soft p-4 h-100">
              <h2 className="h5 mb-3">Get in touch</h2>
              {details.map(
                (d) =>
                  d.value && (
                    <div key={d.label} className="d-flex gap-3 mb-3">
                      <div className="feature"><div className="icon"><i className={`bi ${d.icon}`} /></div></div>
                      <div>
                        <div className="small text-muted">{d.label}</div>
                        <div className="fw-semibold text-navy">{d.value}</div>
                      </div>
                    </div>
                  ),
              )}
              {store.whatsappNumber && (
                <a className="btn btn-success w-100 mt-2" href={whatsappLink(store.whatsappNumber, generalWhatsappMessage(store.name))} target="_blank" rel="noreferrer">
                  <i className="bi bi-whatsapp me-2" />Chat on WhatsApp
                </a>
              )}
              <StoreMap store={store} height={220} className="mt-4" />
              <DirectionsButton store={store} className="btn btn-outline-navy w-100 mt-3" />
            </div>
          </div>
          <div className="col-lg-7">
            {sent ? (
              <div className="card-soft p-4 text-center" role="status">
                <i className="bi bi-envelope-check fs-1 text-orange" />
                <h2 className="h5 mt-2">Thank you! Your message has been sent.</h2>
                <p className="text-muted mb-3">We’ve emailed you a copy and will reply within one business day.</p>
                <button type="button" className="btn btn-outline-navy" onClick={() => setSent(false)}>Send another message</button>
              </div>
            ) : (
            <form className="card-soft p-4" onSubmit={submit}>
              <h2 className="h5 mb-3">Send us a message</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-name">Name *</label>
                  <input id="c-name" className="form-control" required maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-email">Email *</label>
                  <input id="c-email" type="email" className="form-control" required autoComplete="email" value={form.email} onChange={set('email')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-mobile">Mobile</label>
                  <input id="c-mobile" className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="10-digit Indian mobile number" value={form.mobile} onChange={set('mobile')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-order">Order number (optional)</label>
                  <input id="c-order" className="form-control" placeholder="SHM-…" maxLength={30} value={form.orderNumber} onChange={set('orderNumber')} />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="c-subject">Subject *</label>
                  <select id="c-subject" className="form-select" required value={form.subject} onChange={set('subject')}>
                    <option value="" disabled>Choose a topic</option>
                    <option value="order_issue">Order issue</option>
                    <option value="return">Return or exchange</option>
                    <option value="product_question">Product question</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="c-message">Message *</label>
                  <textarea id="c-message" className="form-control" rows={5} required minLength={10} maxLength={2000} value={form.message} onChange={set('message')} />
                </div>
              </div>
              <ConsentCheckbox id="c-consent" purpose="message" className="mt-3 mb-0" checked={form.agree} onChange={(agree) => setForm((f) => ({ ...f, agree }))} />
              {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
              <button type="submit" className="btn btn-orange mt-3" disabled={busy}>{busy ? 'Sending…' : 'Send Message'}</button>
            </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
