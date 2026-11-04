import { DataTable, PageTitle, PhaseNotice, SearchBar } from '../components/ui.jsx';

export default function Customers() {
  return (
    <>
      <PageTitle
        title="Customers"
        subtitle="Everyone who has registered on your store"
        actions={<button type="button" className="btn btn-light" disabled><i className="bi bi-download me-1" />Export</button>}
      />
      <PhaseNotice phase={8}>
        Customers appear here once registration is live (Phase 3). The customer detail view and block/unblock arrive in Phase 8.
      </PhaseNotice>
      <div className="panel">
        <SearchBar placeholder="Search name, email or mobile" />
        <DataTable
          columns={['Name', 'Email', 'Mobile', 'Joined', 'Orders', 'Total Spent', 'Last Order', 'Status']}
          empty="No customers yet."
        />
      </div>
    </>
  );
}
