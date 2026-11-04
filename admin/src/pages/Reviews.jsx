import { useState } from 'react';
import { DataTable, PageTitle, PhaseNotice, Tabs } from '../components/ui.jsx';

export default function Reviews() {
  const [tab, setTab] = useState('Pending');
  return (
    <>
      <PageTitle
        title="Reviews"
        subtitle="Approve reviews before they appear on your store, and reply to customers"
        actions={<button type="button" className="btn btn-orange" disabled><i className="bi bi-check2-all me-1" />Approve selected</button>}
      />
      <PhaseNotice phase={6}>
        Only customers who received the product can review it. Approving, rejecting, hiding and replying start working in Phase 6.
      </PhaseNotice>
      <div className="panel">
        <Tabs tabs={['Pending', 'Approved', 'Rejected', 'Hidden']} active={tab} onChange={setTab} />
        <DataTable
          columns={['', 'Product', 'Customer', 'Rating', 'Review', 'Photos/Video', 'Date', '']}
          empty={`No ${tab.toLowerCase()} reviews.`}
        />
      </div>
    </>
  );
}
