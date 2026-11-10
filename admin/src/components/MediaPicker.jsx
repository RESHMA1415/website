import { useRef, useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Modal, Pagination, useDebounced } from './ui.jsx';

export const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp';
export const ACCEPT_ALL = `${ACCEPT_IMAGES},video/mp4,video/quicktime`;

// Uploads files to the Media Library and reports anything rejected
export function useUploader() {
  const { notify } = useAuth();
  const [uploading, setUploading] = useState(false);
  const upload = async (fileList) => {
    const files = [...fileList].slice(0, 20);
    if (!files.length) return [];
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    setUploading(true);
    try {
      const { saved, errors } = await api('/admin/media', { method: 'POST', body: form });
      if (errors.length) notify(errors.join(' '), 'error');
      else notify(`${saved.length} file${saved.length === 1 ? '' : 's'} uploaded`);
      return saved;
    } catch (err) {
      notify(err.message, 'error');
      return [];
    } finally {
      setUploading(false);
    }
  };
  return { upload, uploading };
}

export function DropZone({ accept = ACCEPT_ALL, onFiles, uploading, compact = false }) {
  const input = useRef();
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`drop-zone ${dragging ? 'dragging' : ''} ${compact ? 'py-3' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <><span className="spinner-border spinner-border-sm me-2" />Uploading and resizing…</>
      ) : (
        <>
          <i className={`bi bi-cloud-arrow-up ${compact ? 'fs-4' : 'fs-1'}`} />
          <div className="mt-1">Drag & drop files here, or <span className="text-orange fw-semibold">click to choose</span></div>
          <div className="small">
            JPG, PNG, WebP up to 5 MB{accept.includes('video') ? ' · MP4 up to 50 MB' : ''} · up to 20 at once
          </div>
        </>
      )}
    </div>
  );
}

export function MediaThumb({ item }) {
  if (item.kind === 'video') return <video src={item.url} muted preload="metadata" />;
  return <img src={item.thumbUrl || item.url} alt={item.originalName || ''} loading="lazy" />;
}

// Pop-up to pick one or more files from the Media Library (or upload new ones)
export function MediaPicker({ kind = 'image', multiple = false, max = 20, onSelect, onClose, title }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const [selected, setSelected] = useState([]);
  const { upload, uploading } = useUploader();
  const query = new URLSearchParams({ page: String(page), limit: '30', kind, q: search });
  const { data, loading, reload } = useApi(`/admin/media?${query}`);

  const toggle = (item) => {
    if (!multiple) {
      setSelected([item]);
      return;
    }
    setSelected((list) =>
      list.some((x) => x._id === item._id) ? list.filter((x) => x._id !== item._id) : list.length >= max ? list : [...list, item],
    );
  };

  const onFiles = async (files) => {
    const saved = (await upload(files)).filter((m) => m.kind === kind);
    if (!saved.length) return;
    setPage(1);
    reload();
    setSelected((list) => (multiple ? [...list, ...saved].slice(0, max) : [saved[0]]));
  };

  return (
    <Modal
      title={title || (kind === 'video' ? 'Choose a video' : multiple ? 'Choose photos' : 'Choose a photo')}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="small text-muted me-auto align-self-center">
            {multiple ? `${selected.length} selected${max < 20 ? ` (up to ${max})` : ''}` : selected[0]?.originalName || 'Nothing selected'}
          </span>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-orange"
            disabled={!selected.length}
            onClick={() => {
              onSelect(multiple ? selected : selected[0]);
              onClose();
            }}
          >
            {multiple ? `Add ${selected.length || ''} ${kind === 'video' ? 'video' : 'photo'}${selected.length === 1 ? '' : 's'}` : 'Use this'}
          </button>
        </>
      }
    >
      <div className="mb-3">
        <DropZone accept={kind === 'video' ? 'video/mp4,video/quicktime' : ACCEPT_IMAGES} onFiles={onFiles} uploading={uploading} compact />
      </div>
      <input
        type="search"
        className="form-control form-control-sm mb-3"
        placeholder="Search by file name"
        aria-label="Search media"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {loading && !data ? (
        <div className="text-muted small">Loading…</div>
      ) : data?.items.length ? (
        <div className="media-grid">
          {data.items.map((item) => {
            const isSelected = selected.some((x) => x._id === item._id);
            return (
              <button key={item._id} type="button" className={`media-tile ${isSelected ? 'selected' : ''}`} onClick={() => toggle(item)} title={item.originalName}>
                <MediaThumb item={item} />
                {isSelected && <span className="tick"><i className="bi bi-check-lg" /></span>}
                <span className="name">{item.originalName}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-muted py-4 small">Nothing here yet. Upload your first {kind === 'video' ? 'video' : 'photos'} above.</div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="files" />}
    </Modal>
  );
}

// A single photo field with preview, e.g. a category image or banner
export function ImageField({ label, value, onChange, hint, ratio = '16 / 9' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="form-label">{label}</div>
      <div className="d-flex gap-3 align-items-start">
        <div className="rounded-3 overflow-hidden bg-light border d-flex align-items-center justify-content-center text-muted flex-shrink-0" style={{ width: 120, aspectRatio: ratio }}>
          {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="bi bi-image fs-4" />}
        </div>
        <div className="d-flex flex-column gap-1">
          <button type="button" className="btn btn-sm btn-light border" onClick={() => setOpen(true)}>
            <i className="bi bi-images me-1" />{value ? 'Change' : 'Choose photo'}
          </button>
          {value && (
            <button type="button" className="btn btn-sm btn-link text-danger p-0 text-start" onClick={() => onChange('')}>
              Remove
            </button>
          )}
          {hint && <div className="form-text mt-0">{hint}</div>}
        </div>
      </div>
      {open && <MediaPicker onClose={() => setOpen(false)} onSelect={(item) => onChange(item.url)} />}
    </div>
  );
}
