import { useState } from 'react';
import { DataTable, PageTitle, PhaseNotice, Tabs } from '../components/ui.jsx';

export default function Messages() {
  const [tab, setTab] = useState('New');
  return (
    <>
      <PageTitle title="Contact Messages" subtitle="Messages sent from the Contact Us page" />
      <PhaseNotice phase={7}>Contact-form messages are saved here from Phase 7.</PhaseNotice>
      <div className="panel">
        <Tabs tabs={['New', 'Replied', 'Closed']} active={tab} onChange={setTab} />
        <DataTable columns={['From', 'Email', 'Subject', 'Order', 'Message', 'Date', '']} empty={`No ${tab.toLowerCase()} messages.`} />
      </div>
    </>
  );
}
