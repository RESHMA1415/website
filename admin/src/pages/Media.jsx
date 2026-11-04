import { useState } from 'react';
import { api, formatDateTime, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DropZone, ImageField, MediaThumb, useUploader } from '../components/MediaPicker.jsx';
import { ErrorNote, Modal, PageTitle, Pagination, Panel, StatusPill, useDebounced } from '../components/ui.jsx';

// yyyy-mm-dd in India time, for the date boxes
const toInputDate = (value) => (value ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');

function BannerEditor({ banner, onClose, onSaved }) {
  const { notify } = useAuth();
  const isNew = !banner._id;
  const [form, setForm] = useState({
    heading: banner.heading || '',
    subHeading: banner.subHeading || '',
    buttonText: banner.buttonText || 'Shop Now',
    buttonLink: banner.buttonLink || '/shop',
    desktopImageUrl: banner.desktopImageUrl || '',
    mobileImageUrl: banner.mobileImageUrl || '',
    activeFrom: toInputDate(banner.activeFrom),
    activeTo: toInputDate(banner.activeTo),
    status: banner.status || 'active',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Dates run from the start of the first day to the end of the last day, India time
      const body = {
        ...form,
        activeFrom: form.activeFrom ? `${form.activeFrom}T00:00:00+05:30` : null,
        activeTo: form.activeTo ? `${form.activeTo}T23:59:59+05:30` : null,
      };
      await api(isNew ? '/admin/banners' : `/admin/banners/${banner._id}`, { method: isNew ? 'POST' : 'PUT', body });
      notify(isNew ? 'Banner added' : 'Banner saved');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Add Banner' : 'Edit Banner'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="banner-form" className="btn btn-orange" disabled={saving}>{saving ? 'Saving…' : 'Save Banner'}</button>
        </>
      }
    >
      <ErrorNote error={error} />
      <form id="banner-form" onSubmit={save} className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="b-heading">Heading *</label>
          <input id="b-heading" className="form-control" required maxLength={80} value={form.heading} onChange={(e) => set('heading', e.target.value)} placeholder="New Season. New You." />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="b-sub">Text under the heading</label>
          <input id="b-sub" className="form-control" maxLength={160} value={form.subHeading} onChange={(e) => set('subHeading', e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="b-btn">Button text</label>
          <input id="b-btn" className="form-control" maxLength={30} value={form.buttonText} onChange={(e) => set('buttonText', e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="b-link">Button opens</label>
          <input id="b-link" className="form-control" value={form.buttonLink} onChange={(e) => set('buttonLink', e.target.value)} placeholder="/women or /category/women-dresses" />
          <div className="form-text">A page on your store, e.g. /new-arrivals, /men, /category/women-dresses</div>
        </div>
        <div className="col-md-6">
          <ImageField label="Desktop image" value={form.desktopImageUrl} onChange={(v) => set('desktopImageUrl', v)} hint="Wide, about 1600 × 600" />
        </div>
        <div className="col-md-6">
          <ImageField label="Mobile image" value={form.mobileImageUrl} onChange={(v) => set('mobileImageUrl', v)} ratio="4 / 5" hint="Tall, about 800 × 1000. Optional." />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="b-from">Show from</label>
          <input id="b-from" type="date" className="form-control" value={form.activeFrom} onChange={(e) => set('activeFrom', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="b-to">Show until</label>
          <input id="b-to" type="date" className="form-control" value={form.activeTo} onChange={(e) => set('activeTo', e.target.value)} />
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" id="b-status" checked={form.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'hidden')} />
            <label className="form-check-label" htmlFor="b-status">Banner is on</label>
          </div>
        </div>
        <div className="col-12 form-text mt-0">Leave the dates empty to show the banner all the time. Without an image, the banner uses your navy & orange background.</div>
      </form>
    </Modal>
  );
}

function bannerState(b) {
  const now = Date.now();
  if (b.status !== 'active') return ['hidden', 'Off'];
  if (b.activeFrom && new Date(b.activeFrom) > now) return ['draft', 'Scheduled'];
  if (b.activeTo && new Date(b.activeTo) < now) return ['draft', 'Ended'];
  return ['active', 'Showing'];
}

function Banners() {
  const { notify } = useAuth();
  const [page, setPage] = useState(1);
  const { data: banners, reload } = useApi(`/admin/banners?page=${page}`);
  const [editing, setEditing] = useState(null);
  const list = banners?.items || [];
  const firstNumber = banners ? (banners.page - 1) * banners.limit : 0;

  const move = async (index, dir) => {
    const ids = list.map((b) => b._id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + dir, 0, id);
    try {
      await api('/admin/banners/order', { method: 'PUT', body: { ids } });
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const remove = async (b) => {
    if (!window.confirm(`Delete the banner “${b.heading}”?`)) return;
    try {
      await api(`/admin/banners/${b._id}`, { method: 'DELETE' });
      notify('Banner deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <Panel
      title="Homepage Banners"
      actions={<button type="button" className="btn btn-sm btn-orange" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />Add Banner</button>}
      bodyClass=""
    >
      {list.length === 0 && <div className="text-center text-muted small py-4">No banners yet.</div>}
      {list.map((b, i) => {
        const [tone, label] = bannerState(b);
        return (
          <div key={b._id} className="d-flex gap-3 align-items-center p-3 border-bottom">
            <div className="d-flex flex-column gap-1">
              <button type="button" className="btn btn-sm btn-light py-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><i className="bi bi-chevron-up" /></button>
              <button type="button" className="btn btn-sm btn-light py-0" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><i className="bi bi-chevron-down" /></button>
            </div>
            <div className="rounded-3 overflow-hidden flex-shrink-0 d-flex align-items-center justify-content-center text-white small" style={{ width: 140, aspectRatio: '16 / 6', background: 'linear-gradient(120deg, #14213d, #22335c)' }}>
              {b.desktopImageUrl ? <img src={b.desktopImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No image'}
            </div>
            <div className="flex-grow-1 small" style={{ minWidth: 0 }}>
              <div className="fw-semibold text-truncate">{firstNumber + i + 1}. {b.heading}</div>
              <div className="text-muted text-truncate">{b.buttonText ? `“${b.buttonText}” → ${b.buttonLink}` : 'No button'}</div>
              {(b.activeFrom || b.activeTo) && (
                <div className="text-muted">{b.activeFrom ? new Date(b.activeFrom).toLocaleDateString('en-IN') : 'Now'} – {b.activeTo ? new Date(b.activeTo).toLocaleDateString('en-IN') : 'no end date'}</div>
              )}
            </div>
            <StatusPill status={tone} label={label} />
            <div className="text-nowrap">
              <button type="button" className="btn btn-sm btn-light" title="Edit" onClick={() => setEditing(b)}><i className="bi bi-pencil" /></button>{' '}
              <button type="button" className="btn btn-sm btn-light text-danger" title="Delete" onClick={() => remove(b)}><i className="bi bi-trash" /></button>
            </div>
          </div>
        );
      })}
      {banners && <Pagination page={banners.page} pages={banners.pages} total={banners.total} onChange={setPage} label="banners" />}
      <div className="small text-muted p-3">The homepage shows up to 5 banners that are on, in this order, rotating every 5 seconds.</div>
      {editing && <BannerEditor banner={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Panel>
  );
}

function Library() {
  const { notify } = useAuth();
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const { upload, uploading } = useUploader();
  const { data, loading, reload } = useApi(`/admin/media?${new URLSearchParams({ page: String(page), q: search, kind })}`);

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.originalName}”?`)) return;
    try {
      await api(`/admin/media/${item._id}`, { method: 'DELETE' });
      notify('File deleted');
      setViewing(null);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <Panel title="Media Library" actions={<span className="small text-muted">{data?.total ?? 0} files</span>}>
      <DropZone uploading={uploading} onFiles={async (files) => { if ((await upload(files)).length) { setPage(1); reload(); } }} />
      <div className="small text-muted mt-2 mb-3">Photos are resized and compressed automatically (large, medium and thumbnail sizes) so your store loads fast.</div>
      <div className="d-flex gap-2 mb-3">
        <input type="search" className="form-control form-control-sm" placeholder="Search by file name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search media" />
        <select className="form-select form-select-sm w-auto" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label="File type">
          <option value="">Photos & videos</option>
          <option value="image">Photos</option>
          <option value="video">Videos</option>
        </select>
      </div>
      {loading && !data ? (
        <div className="small text-muted">Loading…</div>
      ) : data?.items.length ? (
        <div className="media-grid">
          {data.items.map((item) => (
            <button key={item._id} type="button" className="media-tile" onClick={() => setViewing(item)} title={item.originalName}>
              <MediaThumb item={item} />
              {item.kind === 'video' && <span className="kind"><i className="bi bi-play-fill" /> Video</span>}
              <span className="name">{item.originalName}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted small py-4">No files yet. Drag your product photos into the box above.</div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="files" />}

      {viewing && (
        <Modal
          title={viewing.originalName}
          onClose={() => setViewing(null)}
          footer={
            <>
              <button type="button" className="btn btn-light text-danger me-auto" onClick={() => remove(viewing)}><i className="bi bi-trash me-1" />Delete</button>
              <button type="button" className="btn btn-light" onClick={() => setViewing(null)}>Close</button>
            </>
          }
        >
          {viewing.kind === 'video' ? (
            <video src={viewing.url} controls style={{ width: '100%', borderRadius: 8 }} />
          ) : (
            <img src={viewing.mediumUrl || viewing.url} alt="" style={{ width: '100%', borderRadius: 8 }} />
          )}
          <div className="small text-muted mt-2">
            {viewing.width ? `${viewing.width} × ${viewing.height} px · ` : ''}
            {Math.round((viewing.bytes || 0) / 1024)} KB · uploaded {formatDateTime(viewing.createdAt)}
          </div>
          <div className="small text-muted">Files used by a product, banner or category can’t be deleted until you remove them there.</div>
        </Modal>
      )}
    </Panel>
  );
}

export default function Media() {
  return (
    <>
      <PageTitle title="Images & Banners" subtitle="Upload product photos and manage homepage banners" />
      <div className="row g-3">
        <div className="col-xl-6"><Library /></div>
        <div className="col-xl-6"><Banners /></div>
      </div>
    </>
  );
}
