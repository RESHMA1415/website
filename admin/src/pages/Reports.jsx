import { useState } from 'react';
import { formatINR } from '../api.js';
import { PageTitle, Panel, PhaseNotice, StatCard, Tabs } from '../components/ui.jsx';

const REPORTS = ['Sales Summary', 'By Product', 'By Category', 'Payment Methods', 'Returns', 'Customers', 'Inventory', 'Cancellations'];

export default function Reports() {
  const [report, setReport] = useState('Sales Summary');
  return (
    <>
      <PageTitle
        title="Sales Reports"
        subtitle="Choose a date range and download any report to Excel"
        actions={
          <>
            <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="From date" />
            <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="To date" />
            <button type="button" className="btn btn-navy btn-sm" disabled><i className="bi bi-file-earmark-excel me-1" />Export</button>
          </>
        }
      />
      <PhaseNotice phase={8}>Reports fill in from real orders in Phase 8.</PhaseNotice>
      <div className="panel mb-3">
        <Tabs tabs={REPORTS} active={report} onChange={setReport} />
        <div className="panel-body">
          {report === 'Sales Summary' ? (
            <div className="row g-3">
              {[
                ['Gross Sales', 'bi-graph-up-arrow'],
                ['Refunds', 'bi-arrow-counterclockwise'],
                ['Net Sales', 'bi-currency-rupee'],
                ['Average Order Value', 'bi-calculator'],
                ['Delivery Charges Collected', 'bi-truck'],
                ['COD Charges Collected', 'bi-cash-coin'],
              ].map(([label, icon]) => (
                <div key={label} className="col-sm-6 col-xl-4"><StatCard icon={icon} label={label} value={formatINR(0)} /></div>
              ))}
              <div className="col-6 col-xl-4"><StatCard icon="bi-receipt" label="Orders" value="0" /></div>
            </div>
          ) : (
            <div className="chart-placeholder">“{report}” report: chart and table appear here</div>
          )}
        </div>
      </div>
      <Panel title="Sales by Day / Week / Month">
        <div className="chart-placeholder">Sales trend chart</div>
      </Panel>
    </>
  );
}
