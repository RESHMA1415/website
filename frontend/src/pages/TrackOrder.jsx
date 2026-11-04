import { useState } from 'react';
import OrderTimeline from '../components/OrderTimeline.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PhaseNotice from '../components/PhaseNotice.jsx';

// Example timeline so the owner can see how tracking will look
const EXAMPLE_HISTORY = [
  { status: 'confirmed', at: new Date(Date.now() - 3 * 86400000) },
  { status: 'processing', at: new Date(Date.now() - 2 * 86400000) },
  { status: 'shipped', at: new Date(Date.now() - 86400000) },
];

export default function TrackOrder() {
  const [showExample, setShowExample] = useState(false);
  return (
    <>
      <PageHeader title="Track Your Order" crumbs={[{ label: 'Track Order' }]} />
      <div className="container" style={{ maxWidth: 760 }}>
        <PhaseNotice phase={5}>Real order lookups start working in Phase 5. Submitting shows an example.</PhaseNotice>
        <form
          className="card-soft p-4 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setShowExample(true);
          }}
        >
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="t-order">Order number</label>
              <input id="t-order" className="form-control" placeholder="e.g. SHM-261103-0042" required />
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor="t-contact">Mobile number or email</label>
              <input id="t-contact" className="form-control" required />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-orange w-100">Track</button>
            </div>
          </div>
        </form>
        {showExample && (
          <div className="card-soft p-4">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-4">
              <div>
                <div className="small text-muted">Example order</div>
                <div className="fw-semibold text-navy">SHM-261103-0042</div>
              </div>
              <div className="text-md-end">
                <div className="small text-muted">Courier · Tracking no.</div>
                <div className="fw-semibold">Delhivery · 1234567890</div>
              </div>
            </div>
            <OrderTimeline history={EXAMPLE_HISTORY} />
            <button type="button" className="btn btn-outline-navy btn-sm" disabled>
              Track on courier website <i className="bi bi-box-arrow-up-right ms-1" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
