import { useState } from 'react';
import { DataTable, PageTitle, PhaseNotice, Tabs } from '../components/ui.jsx';

const TABS = ['Requested', 'Approved', 'Pickup Scheduled', 'Received', 'Completed', 'Rejected'];

export default function Returns() {
  const [tab, setTab] = useState('Requested');
  return (
    <>
      <PageTitle title="Returns & Exchanges" subtitle="Approve requests, arrange pickups, restock and refund" />
      <PhaseNotice phase={5}>
        Customers can request a return or exchange within 7 days of delivery. Handling requests here starts in Phase 5.
      </PhaseNotice>
      <div className="panel">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <DataTable
          columns={['Order', 'Customer', 'Type', 'Items', 'Reason', 'Requested', 'Status', '']}
          empty="No return or exchange requests."
        />
      </div>
    </>
  );
}
