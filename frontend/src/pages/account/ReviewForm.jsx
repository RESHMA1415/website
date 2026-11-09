import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../../api/client.js';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDate } from '../../utils/format.js';
import AccountLayout from './AccountLayout.jsx';

const FIT = [
  ['runs_small', 'Runs small'],
  ['true_to_size', 'True to size'],
  ['runs_large', 'Runs large'],
];
const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Photos and video are sent as files, not JSON
async function upload(files) {
  const body = new FormData();
  files.forEach((f) => body.append('files', f));
  const token = getToken();
  const response = await fetch('/api/reviews/media', { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'We couldn’t upload that file. Please try again.');
  return data;
}

// Write or edit a verified-buyer review (PRD §11.2)
export default function ReviewForm() {
  const { orderNumber, productId } = useParams();
  const navigate = useNavigate();
  const { notify } = useStore();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ rating: 0, title: '', text: '', fitFeedback: '', photos: [], videoUrl: '' });
  const [hover, setHover] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photoInput = useRef();
  const videoInput = useRef();

  useEffect(() => {
    api(`/orders/${orderNumber}/review/${productId}`)
      .then((data) => {
        setInfo(data);
        if (data.review) {
          const r = data.review;
          setForm({ rating: r.rating, title: r.title || '', text: r.text, fitFeedback: r.fitFeedback || '', photos: r.photos || [], videoUrl: r.videoUrl || '' });
        }
      })
      .catch((err) => setLoadError(err.message));
  }, [orderNumber, productId]);

  const rules = info?.rules || { titleMax: 80, textMin: 10, textMax: 1000, photosMax: 5 };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const locked = info?.review && !info.review.canEdit;

  const addFiles = async (e, kind) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const room = rules.photosMax - form.photos.length;
    const chosen = kind === 'photo' ? files.slice(0, room) : files.slice(0, 1);
    if (!chosen.length) return;
    setUploading(true);
    setError('');
    try {
      const r = await upload(chosen);
      setForm((f) => ({ ...f, photos: [...f.photos, ...r.photos].slice(0, rules.photosMax), videoUrl: r.videoUrl || f.videoUrl }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) {
      setError('Please choose a star rating.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${orderNumber}/review/${productId}`, { method: 'POST', body: form });
      notify(info?.review ? 'Thanks! Your edited review will appear once it’s approved.' : 'Thank you! Your review will appear once it’s approved.');
      navigate('/account/reviews', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const shown = hover || form.rating;
  return (
    <AccountLayout title={info?.review ? 'Edit your review' : 'Write a review'} crumbs={[{ label: 'Reviews', to: '/account/reviews' }, { label: info?.name || 'Review' }]}>
      {loadError && <div className="alert alert-danger">{loadError} <Link to="/account/reviews">Back to My Reviews</Link></div>}
      {!info && !loadError && <div className="card-soft p-4 text-muted">Loading…</div>}
      {info && (
        <form className="card-soft p-4" onSubmit={submit}>
          <div className="d-flex gap-3 align-items-center mb-4">
            <div className="cart-line-image" style={{ width: 64, height: 80 }}>
              {info.imageUrl ? <img src={info.imageUrl} alt="" /> : <i className="bi bi-image text-muted" />}
            </div>
            <div>
              <div className="fw-semibold">{info.name}</div>
              <div className="small text-muted">Order {info.orderNumber}{info.variantLabel ? ` · Bought: ${info.variantLabel}` : ''}</div>
            </div>
          </div>
          {info.review && (
            <div className={`alert small ${locked ? 'alert-warning' : 'alert-light'}`}>
              {locked
                ? `Reviews can be edited for 30 days. This one can no longer be changed.`
                : `You can edit this review until ${formatDate(info.review.editableUntil)}. Edits are checked again before they appear.`}
            </div>
          )}
          <fieldset disabled={locked}>
            <div className="mb-3">
              <div className="form-label">Your rating *</div>
              <div className="d-flex align-items-center gap-3">
                <div className="star-input" role="radiogroup" aria-label="Star rating" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={form.rating === n}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      className={n <= shown ? 'on' : ''}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="small text-muted">{STAR_WORDS[shown]}</span>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="rv-title">Title (optional)</label>
              <input id="rv-title" className="form-control" maxLength={rules.titleMax} placeholder="e.g. Perfect for summer" value={form.title} onChange={set('title')} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="rv-text">Your review *</label>
              <textarea id="rv-text" className="form-control" rows={5} required minLength={rules.textMin} maxLength={rules.textMax} placeholder="What did you like? How is the quality and fit?" value={form.text} onChange={set('text')} />
              <div className="form-text text-end">{form.text.length}/{rules.textMax}</div>
            </div>
            {info.askFit && (
              <div className="mb-3">
                <div className="form-label">How does it fit? (optional)</div>
                <div className="d-flex flex-wrap gap-3">
                  {FIT.map(([value, label]) => (
                    <div key={value} className="form-check">
                      <input className="form-check-input" type="radio" name="rv-fit" id={`rv-fit-${value}`} checked={form.fitFeedback === value} onChange={() => setForm((f) => ({ ...f, fitFeedback: value }))} />
                      <label className="form-check-label" htmlFor={`rv-fit-${value}`}>{label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <div className="form-label">Photos and video (optional)</div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                {form.videoUrl && (
                  <div className="position-relative">
                    <video src={form.videoUrl} className="return-photo" muted playsInline />
                    <button type="button" className="btn btn-sm btn-light position-absolute top-0 end-0 p-0 px-1" aria-label="Remove video" onClick={() => setForm((f) => ({ ...f, videoUrl: '' }))}>×</button>
                  </div>
                )}
                {form.photos.map((src) => (
                  <div key={src} className="position-relative">
                    <img src={src} alt="Your photo" className="return-photo" />
                    <button type="button" className="btn btn-sm btn-light position-absolute top-0 end-0 p-0 px-1" aria-label="Remove photo" onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== src) }))}>×</button>
                  </div>
                ))}
                {form.photos.length < rules.photosMax && (
                  <button type="button" className="btn btn-outline-navy btn-sm" disabled={uploading} onClick={() => photoInput.current.click()}><i className="bi bi-camera me-1" />Add photos</button>
                )}
                {!form.videoUrl && (
                  <button type="button" className="btn btn-outline-navy btn-sm" disabled={uploading} onClick={() => videoInput.current.click()}><i className="bi bi-camera-video me-1" />Add a video</button>
                )}
                {uploading && <span className="small text-muted">Uploading…</span>}
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addFiles(e, 'photo')} />
                <input ref={videoInput} type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => addFiles(e, 'video')} />
              </div>
              <div className="form-text">Up to {rules.photosMax} photos (JPG, PNG or WebP, 5 MB each) and 1 video (MP4 or MOV, up to 60 seconds, 50 MB).</div>
            </div>
          </fieldset>
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <p className="small text-muted">Your review appears with your first name and last initial once we’ve checked it. See our <Link to="/policies/terms" target="_blank">Terms</Link>.</p>
          <div className="d-flex gap-2">
            {!locked && <button type="submit" className="btn btn-orange" disabled={busy || uploading}>{busy ? 'Sending…' : info.review ? 'Save changes' : 'Submit review'}</button>}
            <Link to="/account/reviews" className="btn btn-outline-navy">Back</Link>
          </div>
        </form>
      )}
    </AccountLayout>
  );
}
