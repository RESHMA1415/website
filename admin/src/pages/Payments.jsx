import { formatINR } from '../api.js';
import { DataTable, PageTitle, PhaseNotice, SearchBar, StatCard } from '../components/ui.jsx';

export default function Payments() {
  return (
    <>
      <PageTitle
        title="Payments"
        subtitle="Online payments, Cash on Delivery and refunds"
        actions={<button type="button" className="btn btn-light" disabled><i className="bi bi-download me-1" />Export</button>}
      />
      <PhaseNotice phase={4}>Razorpay payments are recorded here from Phase 4. Refunds are added in Phase 5.</PhaseNotice>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="bi-credit-card" label="Collected Online" value={formatINR(0)} tone="green" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-cash-coin" label="COD Collected" value={formatINR(0)} /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-hourglass-split" label="COD Pending" value={formatINR(0)} tone="orange" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="bi-arrow-counterclockwise" label="Refunds Issued" value={formatINR(0)} tone="red" /></div>
      </div>
      <div className="panel">
        <SearchBar placeholder="Search order number or payment ID">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Status">
            <option>All statuses</option><option>Paid</option><option>Failed</option><option>Refunded</option><option>COD Pending</option><option>COD Collected</option>
          </select>
        </SearchBar>
        <DataTable columns={['Date', 'Order', 'Customer', 'Amount', 'Method', 'Razorpay ID', 'Status', '']} empty="No payments yet." />
      </div>
    </>
  );
}
