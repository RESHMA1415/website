import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StoreMap, { DirectionsButton } from '../components/StoreMap.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { generalWhatsappMessage, whatsappLink } from '../utils/format.js';

export default function Contact() {
  const { settings, notify } = useStore();
  const { store } = settings;
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
            <form
              className="card-soft p-4"
              onSubmit={(e) => {
                e.preventDefault();
                notify('Contact messages are saved to your admin panel starting Phase 7.');
              }}
            >
              <h2 className="h5 mb-3">Send us a message</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-name">Name *</label>
                  <input id="c-name" className="form-control" required autoComplete="name" />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-email">Email *</label>
                  <input id="c-email" type="email" className="form-control" required autoComplete="email" />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-mobile">Mobile</label>
                  <input id="c-mobile" className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-order">Order number (optional)</label>
                  <input id="c-order" className="form-control" placeholder="SHM-…" />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="c-subject">Subject *</label>
                  <select id="c-subject" className="form-select" required defaultValue="">
                    <option value="" disabled>Choose a topic</option>
                    <option value="order_issue">Order issue</option>
                    <option value="return">Return or exchange</option>
                    <option value="product_question">Product question</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="c-message">Message *</label>
                  <textarea id="c-message" className="form-control" rows={5} required maxLength={2000} />
                </div>
              </div>
              <ConsentCheckbox id="c-consent" purpose="message" className="mt-3 mb-0" />
              <button type="submit" className="btn btn-orange mt-3">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
