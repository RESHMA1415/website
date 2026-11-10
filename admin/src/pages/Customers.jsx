import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadFile, formatDateTime, formatINR, useApi } from '../api.js';
import { DataTable, ErrorNote, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';

// Customer Management (PRD §14.6)
export default function Customers() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const params = new URLSearchParams({ q: search, status, sort, page });
  const { data, loading, error } = useApi(`/admin/customers?${params}`);
  const items = loading ? [] : data?.items || [];

  return (
    <>
      <PageTitle
        title="Customers"
        subtitle="Everyone who has registered on your store"
        actions={
          <button type="button" className="btn btn-light" onClick={() => downloadFile(`/admin/customers/export?${new URLSearchParams({ q: search, status })}`, 'shopme-customers.csv')}>
            <i className="bi bi-download me-1" />Download for Excel
          </button>
        }
      />
      <div className="panel">
        <SearchBar placeholder="Search name, email or mobile" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All customers</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked{data?.blocked ? ` (${data.blocked})` : ''}</option>
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </SearchBar>
        <div className="px-3"><ErrorNote error={error} /></div>
        <DataTable
          columns={['Name', 'Email', 'Mobile', 'Joined', 'Orders', 'Total Spent', 'Last Order', 'Status']}
          rows={items}
          empty={loading ? 'Loading…' : 'No customers found.'}
          renderRow={(c) => (
            <tr key={c._id}>
              <td><Link to={`/customers/${c._id}`} className="fw-semibold">{c.name}</Link></td>
              <td className="small">{c.email}</td>
              <td className="small">{c.mobile}</td>
              <td className="small text-nowrap">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
              <td>{c.orders}</td>
              <td className="fw-semibold">{formatINR(c.spent)}</td>
              <td className="small text-nowrap">{c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '–'}</td>
              <td>{c.isBlocked ? <span className="status-pill tone-red">Blocked</span> : <span className="status-pill tone-green">Active</span>}</td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="customers" />}
      </div>
    </>
  );
}
