import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useShopper } from '../context/ShopperContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatDate } from '../utils/format.js';
import Stars from './Stars.jsx';

const SORTS = [
  ['recent', 'Most recent'],
  ['highest', 'Highest rating'],
  ['lowest', 'Lowest rating'],
  ['media', 'With photos/videos'],
];

// Full-size photo or video from a review
function MediaViewer({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="shop-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shop-modal p-2" role="dialog" aria-modal="true" aria-label="Customer photo" style={{ maxWidth: 760 }}>
        <div className="d-flex justify-content-between align-items-center px-2 pb-2">
          <span className="small text-muted">{item.author ? `From ${item.author}` : 'Customer photo'}</span>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        {item.type === 'video' ? (
          <video src={item.url} controls autoPlay playsInline className="w-100 rounded-3" style={{ maxHeight: '75vh' }} />
        ) : (
          <img src={item.url} alt="Customer photo" className="w-100 rounded-3" style={{ maxHeight: '75vh', objectFit: 'contain' }} />
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, onHelpful, onOpen }) {
  return (
    <article className="review-card">
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <div>
          <Stars value={review.rating} />
          {review.title && <span className="fw-semibold ms-2">{review.title}</span>}
        </div>
        <span className="small text-muted">{formatDate(review.date)}{review.edited ? ' · edited' : ''}</span>
      </div>
      <div className="small text-muted mt-1">
        <strong className="text-navy">{review.author}</strong>
        <span className="verified-badge ms-2"><i className="bi bi-patch-check-fill me-1" />Verified Buyer</span>
        {review.variantLabel && <span className="ms-2">Bought: {review.variantLabel}</span>}
        {review.fit && <span className="ms-2">· Fit: {review.fit}</span>}
      </div>
      <p className="mt-2 mb-2" style={{ whiteSpace: 'pre-line' }}>{review.text}</p>
      {(review.photos.length > 0 || review.videoUrl) && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {review.videoUrl && (
            <button type="button" className="review-thumb video" aria-label="Play the customer’s video" onClick={() => onOpen({ type: 'video', url: review.videoUrl, author: review.author })}>
              <i className="bi bi-play-fill" />
            </button>
          )}
          {review.photos.map((url) => (
            <button key={url} type="button" className="review-thumb" aria-label="Open photo" onClick={() => onOpen({ type: 'photo', url, author: review.author })}>
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {review.reply && (
        <div className="review-reply">
          <div className="fw-semibold small text-navy">Response from SHOPME</div>
          <div className="small" style={{ whiteSpace: 'pre-line' }}>{review.reply.text}</div>
        </div>
      )}
      {!review.mine && (
        <button type="button" className={`btn btn-link btn-sm p-0 mt-1 ${review.votedHelpful ? 'text-success' : ''}`} disabled={review.votedHelpful} onClick={() => onHelpful(review)}>
          <i className={`bi ${review.votedHelpful ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'} me-1`} />
          Helpful{review.helpful ? ` (${review.helpful})` : ''}
        </button>
      )}
    </article>
  );
}

// Ratings & reviews on the product page (PRD §11.4)
export default function ProductReviews({ product }) {
  const { notify } = useStore();
  const { user } = useShopper();
  const navigate = useNavigate();
  const [sort, setSort] = useState('recent');
  const [stars, setStars] = useState(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ sort, page, ...(stars ? { rating: stars } : {}) });
    api(`/products/${product.slug}/reviews?${params}`)
      .then((d) => {
        if (cancelled) return;
        setData((prev) => (page === 1 ? d : { ...d, gallery: prev?.gallery || [] }));
        setItems((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product.slug, sort, stars, page, user?._id]);

  const choose = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const helpful = async (review) => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/product/${product.slug}#reviews`)}`);
      return;
    }
    try {
      const r = await api(`/reviews/${review.id}/helpful`, { method: 'POST' });
      setItems((list) => list.map((x) => (x.id === review.id ? { ...x, ...r } : x)));
    } catch (err) {
      notify(err.message);
    }
  };

  const summary = data?.summary || { average: product.ratingAverage, count: product.ratingCount, breakdown: product.ratingBreakdown || {} };
  const total = summary.count || 0;

  return (
    <section className="section pb-0" id="reviews">
      <h2 className="section-title mb-4">Ratings & Reviews</h2>
      <div className="row g-4">
        <div className="col-md-4">
          <div className="card-soft p-4 text-center">
            <div className="display-5 fw-bold text-navy">{total ? summary.average.toFixed(1) : '–'}</div>
            <Stars value={summary.average} className="fs-5" />
            <div className="small text-muted mt-1">{total} review{total === 1 ? '' : 's'}</div>
            <div className="mt-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.breakdown?.[star] || 0;
                return (
                  <button
                    key={star}
                    type="button"
                    className={`rating-row ${stars === star ? 'active' : ''}`}
                    disabled={!count}
                    onClick={() => choose(setStars)(stars === star ? 0 : star)}
                  >
                    <span className="visually-hidden">Show {star}-star reviews ({count})</span>
                    <span style={{ width: 28 }} aria-hidden="true">{star}★</span>
                    <span className="rating-bar" aria-hidden="true"><span style={{ width: total ? `${(count / total) * 100}%` : 0 }} /></span>
                    <span className="text-muted" style={{ width: 24 }} aria-hidden="true">{count}</span>
                  </button>
                );
              })}
            </div>
            <p className="small text-muted mt-3 mb-0">Only customers who bought and received this product can review it.</p>
          </div>
        </div>
        <div className="col-md-8">
          {data?.gallery?.length > 0 && (
            <div className="mb-3">
              <div className="small fw-semibold mb-2">Customer photos & videos</div>
              <div className="d-flex flex-wrap gap-2">
                {data.gallery.map((g) => (
                  <button key={g.url} type="button" className={`review-thumb ${g.type === 'video' ? 'video' : ''}`} aria-label={g.type === 'video' ? 'Play customer video' : 'Open customer photo'} onClick={() => setViewing(g)}>
                    {g.type === 'video' ? <i className="bi bi-play-fill" /> : <img src={g.url} alt="" loading="lazy" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {total > 0 ? (
            <>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <label className="small text-muted" htmlFor="review-sort">Sort</label>
                <select id="review-sort" className="form-select form-select-sm" style={{ width: 'auto' }} value={sort} onChange={(e) => choose(setSort)(e.target.value)}>
                  {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {stars > 0 && (
                  <button type="button" className="btn btn-sm btn-light" onClick={() => choose(setStars)(0)}>
                    {stars}★ only <i className="bi bi-x" />
                  </button>
                )}
              </div>
              <div className="d-grid gap-3">
                {items.map((r) => <ReviewCard key={r.id} review={r} onHelpful={helpful} onOpen={setViewing} />)}
                {data && items.length === 0 && <div className="small text-muted">No reviews match this filter.</div>}
              </div>
              {data && page < data.pages && (
                <button type="button" className="btn btn-outline-navy btn-sm mt-3" onClick={() => setPage((p) => p + 1)}>Show more reviews</button>
              )}
            </>
          ) : (
            <div className="card-soft p-4 h-100 d-flex flex-column justify-content-center text-center">
              <i className="bi bi-chat-square-heart fs-1 text-orange" />
              <h3 className="h5 mt-2">No reviews yet</h3>
              <p className="text-muted small mb-0">Bought this? Once it’s delivered, you can review it from My Orders, with photos or a video.</p>
            </div>
          )}
        </div>
      </div>
      {viewing && <MediaViewer item={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
