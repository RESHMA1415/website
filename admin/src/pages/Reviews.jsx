import { useState } from 'react';
import { api, formatDateTime, useApi, STORE_URL } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorNote, PageTitle, Pagination, SearchBar, useDebounced } from '../components/ui.jsx';

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['hidden', 'Hidden'],
];

const stars = (n) => <span className="text-warning" aria-label={`${n} stars`}>{'★'.repeat(n)}<span className="text-muted">{'★'.repeat(5 - n)}</span></span>;

function ReviewRow({ review, selected, onSelect, onChanged }) {
  const { notify } = useAuth();
  const [mode, setMode] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);

  const act = async (action, body) => {
    setBusy(true);
    try {
      await api(`/admin/reviews/${review.id}/${action}`, { method: 'POST', body });
      notify({ approve: 'Review approved', reject: 'Review rejected', hide: 'Review hidden', unhide: 'Review shown again', reply: 'Reply saved', 'delete-reply': 'Reply deleted' }[action]);
      setMode('');
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const openMode = (m) => {
    setMode(m);
    setText(m === 'reply' ? review.reply?.text || '' : '');
  };

  return (
    <div className="border-bottom p-3">
      <div className="d-flex gap-3">
        {review.status === 'pending' && (
          <input type="checkbox" className="form-check-input mt-1" aria-label="Select review" checked={selected} onChange={onSelect} />
        )}
        <div className="thumb flex-shrink-0">{review.product?.imageUrl ? <img src={review.product.imageUrl} alt="" /> : <i className="bi bi-image" />}</div>
        <div className="flex-grow-1 small" style={{ minWidth: 0 }}>
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <div>
              {review.product ? <a href={`${STORE_URL}/product/${review.product.slug}#reviews`} target="_blank" rel="noreferrer" className="fw-semibold">{review.product.name}</a> : <span className="fw-semibold">Deleted product</span>}
              <span className="text-muted ms-2">Order {review.orderNumber}</span>
            </div>
            <span className="text-muted">{formatDateTime(review.createdAt)}{review.editedAt ? ' · edited' : ''}</span>
          </div>
          <div className="mt-1">{stars(review.rating)} {review.title && <strong className="ms-1">{review.title}</strong>}</div>
          <p className="mb-1 mt-1" style={{ whiteSpace: 'pre-line' }}>{review.text}</p>
          <div className="text-muted">
            {review.author} ({review.customer?.email || 'account deleted'}){review.variantLabel ? ` · Bought: ${review.variantLabel}` : ''}{review.fit ? ` · Fit: ${review.fit}` : ''}{review.helpful ? ` · ${review.helpful} found helpful` : ''}
          </div>
          {(review.photos.length > 0 || review.videoUrl) && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {review.videoUrl && <button type="button" className="btn btn-sm btn-light" onClick={() => setViewing({ type: 'video', url: review.videoUrl })}><i className="bi bi-play-circle me-1" />Video</button>}
              {review.photos.map((url) => (
                <button key={url} type="button" className="p-0 border-0 bg-transparent" onClick={() => setViewing({ type: 'photo', url })} aria-label="View photo">
                  <img src={url} alt="" className="return-photo" style={{ width: 64, height: 64 }} />
                </button>
              ))}
            </div>
          )}
          {viewing && (
            <div className="mt-2">
              {viewing.type === 'video' ? <video src={viewing.url} controls autoPlay className="rounded" style={{ maxWidth: '100%', maxHeight: 360 }} /> : <img src={viewing.url} alt="Customer photo" className="rounded" style={{ maxWidth: '100%', maxHeight: 360 }} />}
              <div><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setViewing(null)}>Close</button></div>
            </div>
          )}
          {review.rejectionReason && <div className="text-danger mt-1">Rejected (internal note): {review.rejectionReason}</div>}
          {review.reply && mode !== 'reply' && (
            <div className="mt-2 p-2 rounded" style={{ background: '#f7f8fb', borderLeft: '3px solid #ff7a00' }}>
              <div className="fw-semibold">Response from SHOPME</div>
              <div style={{ whiteSpace: 'pre-line' }}>{review.reply.text}</div>
            </div>
          )}

          <div className="d-flex flex-wrap gap-2 mt-2">
            {['pending', 'rejected'].includes(review.status) && <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={() => act('approve')}>Approve</button>}
            {review.status !== 'rejected' && <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => openMode('reject')}>Reject</button>}
            {review.status === 'approved' && <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => act('hide')}>Hide</button>}
            {review.status === 'hidden' && <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => act('unhide')}>Show again</button>}
            <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => openMode('reply')}>{review.reply ? 'Edit reply' : 'Reply'}</button>
            {review.reply && <button type="button" className="btn btn-sm btn-link text-danger" disabled={busy} onClick={() => window.confirm('Delete your reply?') && act('delete-reply')}>Delete reply</button>}
          </div>

          {mode && (
            <form className="mt-2" onSubmit={(e) => { e.preventDefault(); act(mode, mode === 'reply' ? { text } : { reason: text }); }}>
              <label className="form-label" htmlFor={`rv-${mode}-${review.id}`}>{mode === 'reply' ? 'Your public reply (shown as “Response from SHOPME”)' : 'Why are you rejecting it? (only you see this)'}</label>
              <textarea id={`rv-${mode}-${review.id}`} className="form-control form-control-sm" rows={2} maxLength={mode === 'reply' ? 1000 : 300} required value={text} onChange={(e) => setText(e.target.value)} />
              <div className="d-flex gap-2 mt-2">
                <button type="submit" className={`btn btn-sm ${mode === 'reply' ? 'btn-orange' : 'btn-danger'}`} disabled={busy}>{mode === 'reply' ? 'Save reply' : 'Reject review'}</button>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setMode('')}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Review moderation (PRD §11.3, §14.9)
export default function Reviews() {
  const { notify } = useAuth();
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi(`/admin/reviews?${new URLSearchParams({ tab, q: search, rating, page })}`);
  // While another tab or page loads, don't show the previous list (avoids clicking on the wrong review)
  const items = loading ? [] : data?.items || [];

  const bulkApprove = async () => {
    try {
      const r = await api('/admin/reviews/bulk-approve', { method: 'POST', body: { ids: selected } });
      notify(`${r.approved} review(s) approved`);
      setSelected([]);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const allChecked = items.length > 0 && items.every((r) => selected.includes(r.id));

  return (
    <>
      <PageTitle
        title="Reviews"
        subtitle="Approve reviews before they appear on your store, and reply to customers"
        actions={tab === 'pending' && <button type="button" className="btn btn-orange" disabled={!selected.length} onClick={bulkApprove}><i className="bi bi-check2-all me-1" />Approve selected{selected.length ? ` (${selected.length})` : ''}</button>}
      />
      <div className="panel">
        <ul className="nav nav-tabs px-3 pt-2">
          {TABS.map(([key, label]) => (
            <li key={key} className="nav-item">
              <button type="button" className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setPage(1); setSelected([]); }}>
                {label}
                {data?.counts?.[key] > 0 && <span className="badge rounded-pill text-bg-light ms-1">{data.counts[key]}</span>}
              </button>
            </li>
          ))}
        </ul>
        <SearchBar placeholder="Search product, customer name or words in the review" value={q} onChange={(v) => { setQ(v); setPage(1); }}>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Stars" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
            <option value="">All stars</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
          </select>
          {tab === 'pending' && items.length > 0 && (
            <label className="small d-flex align-items-center gap-1 ms-auto">
              <input type="checkbox" className="form-check-input mt-0" checked={allChecked} onChange={() => setSelected(allChecked ? [] : items.map((r) => r.id))} /> Select all
            </label>
          )}
        </SearchBar>
        <div className="px-3"><ErrorNote error={error} /></div>
        {items.length === 0 ? (
          <div className="text-center text-muted py-5"><i className="bi bi-inbox fs-3 d-block mb-2" />{loading ? 'Loading…' : `No ${tab} reviews.`}</div>
        ) : (
          items.map((r) => (
            <ReviewRow
              key={r.id}
              review={r}
              selected={selected.includes(r.id)}
              onSelect={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
              onChanged={() => { setSelected((s) => s.filter((x) => x !== r.id)); reload(); }}
            />
          ))
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="reviews" />}
      </div>
    </>
  );
}
