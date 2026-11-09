import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, formatDateTime, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DataTable, ErrorNote, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';

const TABS = [
  ['new', 'New'],
  ['replied', 'Replied'],
  ['closed', 'Closed'],
  ['newsletter', 'Newsletter sign-ups'],
];

// "Reply by email" opens the admin's own email app with the customer's message quoted
function replyLink(m) {
  const subject = `Re: your message to SHOPME${m.orderNumber ? ` (order ${m.orderNumber})` : ''}`;
  const body = `Hi ${m.name},\n\n\n\n---\nYour message (${new Date(m.createdAt).toLocaleDateString('en-IN')}):\n${m.message}`;
  return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function MessageRow({ m, onChanged }) {
  const { notify } = useAuth();
  const [open, setOpen] = useState(m.status === 'new');
  const [note, setNote] = useState(m.adminNote || '');
  const [busy, setBusy] = useState(false);
  const save = async (body, done) => {
    setBusy(true);
    try {
      await api(`/admin/messages/${m._id}`, { method: 'PATCH', body });
      notify(done);
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-bottom p-3">
      <button type="button" className="btn btn-link p-0 text-start text-reset w-100 text-decoration-none" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="d-flex flex-wrap justify-content-between gap-2 small">
          <div>
            <strong>{m.name}</strong> <span className="text-muted">· {m.email}{m.mobile ? ` · ${m.mobile}` : ''}</span>
            <div><span className="status-pill tone-navy">{m.subjectLabel}</span>{m.orderNumber && <span className="ms-2">Order {m.orderNumber}</span>}</div>
          </div>
          <span className="text-muted">{formatDateTime(m.createdAt)} <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} ms-1`} /></span>
        </div>
        {!open && <div className="small text-muted text-truncate mt-1">{m.message}</div>}
      </button>
      {open && (
        <div className="mt-2 small">
          <p style={{ whiteSpace: 'pre-line' }}>{m.message}</p>
          {m.orderNumber && <p><Link to={`/orders/${m.orderNumber}`}>Open order {m.orderNumber}</Link></p>}
          <div className="d-flex flex-wrap gap-2 mb-2">
            <a className="btn btn-sm btn-orange" href={replyLink(m)}><i className="bi bi-reply me-1" />Reply by email</a>
            {m.status !== 'replied' && <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => save({ status: 'replied' }, 'Marked as replied')}>Mark replied</button>}
            {m.status !== 'closed' && <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => save({ status: 'closed' }, 'Closed')}>Close</button>}
            {m.status !== 'new' && <button type="button" className="btn btn-sm btn-link" disabled={busy} onClick={() => save({ status: 'new' }, 'Moved back to New')}>Move to New</button>}
          </div>
          <form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); save({ adminNote: note }, 'Note saved'); }}>
            <input className="form-control form-control-sm" maxLength={1000} placeholder="Private note (only you see this)" aria-label="Private note" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="btn btn-sm btn-light" disabled={busy}>Save note</button>
          </form>
          {m.repliedAt && <div className="text-muted mt-1">Replied {formatDateTime(m.repliedAt)}</div>}
        </div>
      )}
    </div>
  );
}

function Newsletter() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('subscribed');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error } = useApi(`/admin/newsletter?${new URLSearchParams({ q: search, status, page })}`);
  return (
    <>
      <SearchBar placeholder="Search email or mobile" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
        <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <button type="button" className="btn btn-sm btn-light ms-auto" disabled={!data?.subscribed} onClick={() => downloadFile('/admin/newsletter/export', 'shopme-newsletter.csv')}>
          <i className="bi bi-download me-1" />Export {data?.subscribed ?? ''} subscribers (CSV)
        </button>
      </SearchBar>
      <div className="px-3"><ErrorNote error={error} /></div>
      <DataTable
        columns={['Email', 'Mobile / WhatsApp', 'Signed up', 'Source', status === 'unsubscribed' ? 'Left on' : 'Consent']}
        rows={data?.items || []}
        empty={loading ? 'Loading…' : 'No sign-ups yet.'}
        renderRow={(s) => (
          <tr key={s._id}>
            <td className="small">{s.email || '–'}</td>
            <td className="small">{s.mobile || '–'}</td>
            <td className="small text-nowrap">{formatDateTime(s.createdAt)}</td>
            <td className="small">{s.source}</td>
            <td className="small text-muted">{status === 'unsubscribed' ? formatDateTime(s.unsubscribedAt) : `Policy ${s.consent?.policyVersion || '–'}`}</td>
          </tr>
        )}
      />
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="sign-ups" />}
    </>
  );
}

// Contact Us inbox (PRD §14.12) and newsletter sign-ups
export default function Messages() {
  const [tab, setTab] = useState('new');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const isInbox = tab !== 'newsletter';
  const { data, loading, error, reload } = useApi(isInbox ? `/admin/messages?${new URLSearchParams({ tab, q: search, page })}` : null);
  const items = loading ? [] : data?.items || [];

  return (
    <>
      <PageTitle title="Contact Messages" subtitle="Messages from the Contact Us page, and newsletter sign-ups" />
      <div className="panel">
        <ul className="nav nav-tabs px-3 pt-2">
          {TABS.map(([key, label]) => (
            <li key={key} className="nav-item">
              <button type="button" className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setPage(1); }}>
                {label}
                {data?.counts?.[key] > 0 && <span className="badge rounded-pill text-bg-light ms-1">{data.counts[key]}</span>}
              </button>
            </li>
          ))}
        </ul>
        {isInbox ? (
          <>
            <SearchBar placeholder="Search name, email, mobile, order or words" value={q} onChange={(v) => { setQ(v); setPage(1); }} />
            <div className="px-3"><ErrorNote error={error} /></div>
            {items.length === 0 ? (
              <div className="text-center text-muted py-5"><i className="bi bi-inbox fs-3 d-block mb-2" />{loading ? 'Loading…' : 'No messages here.'}</div>
            ) : (
              items.map((m) => <MessageRow key={m._id} m={m} onChanged={reload} />)
            )}
            {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="messages" />}
          </>
        ) : (
          <Newsletter />
        )}
      </div>
    </>
  );
}
