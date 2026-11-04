import { useState } from 'react';
import { DataTable, PageTitle, PhaseNotice, SearchBar, Tabs } from '../components/ui.jsx';

const TABS = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'All'];

export default function Orders() {
  const [tab, setTab] = useState('New');
  return (
    <>
      <PageTitle
        title="Orders"
        subtitle="Pack, ship and track every order"
        actions={<button type="button" className="btn btn-light" disabled><i className="bi bi-printer me-1" />Print packing slips</button>}
      />
      <PhaseNotice phase={5}>
        Orders appear here once checkout is live (Phase 4). Updating status, adding courier tracking and printing packing slips arrive in Phase 5.
      </PhaseNotice>
      <div className="panel">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <SearchBar placeholder="Search order number, customer or mobile">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Payment method">
            <option>All payments</option><option>Online</option><option>Cash on Delivery</option>
          </select>
          <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="From date" />
          <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="To date" />
        </SearchBar>
        <DataTable
          columns={['Order', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', '']}
          empty={`No ${tab === 'All' ? '' : tab.toLowerCase() + ' '}orders yet.`}
        />
      </div>
    </>
  );
}
