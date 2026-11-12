import { useApi } from '../hooks/useApi.js';
import Stars from './Stars.jsx';

// "What Our Customers Say" on the homepage: the store's Google rating and the
// reviews Google shares (at most 5), with links to read all and write one on Google.
// Until Google reviews are set up (Admin → Business Settings), a friendly placeholder shows.
export default function GoogleReviews() {
  const { data } = useApi('/google-reviews');

  return (
    <section className="section pt-0" aria-labelledby="google-reviews-title">
      <div className="container">
        <h2 className="section-title" id="google-reviews-title">What Our Customers Say</h2>
        {!data?.enabled ? (
          <>
            <p className="section-subtitle">Real reviews from our customers</p>
            <div className="card-soft p-4 text-center text-muted">
              <i className="bi bi-chat-heart fs-1 text-orange" aria-hidden="true" />
              <p className="mb-0 mt-2">Customer reviews will appear here once your first buyers share their experience.</p>
            </div>
          </>
        ) : (
          <>
            <div className="google-summary">
              <span className="google-mark" aria-hidden="true"><i className="bi bi-google" /></span>
              <span className="google-score">{data.rating.toFixed(1)}</span>
              <Stars value={Math.round(data.rating * 2) / 2} />
              <span className="text-muted small">
                Based on {data.count.toLocaleString('en-IN')} Google review{data.count === 1 ? '' : 's'}
              </span>
            </div>

            {data.reviews.length > 0 && (
              <ul className="google-reviews list-unstyled">
                {data.reviews.map((r, i) => (
                  <li key={`${r.author}-${i}`} className="google-review card-soft">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt="" className="google-avatar" width="40" height="40" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="google-avatar google-avatar-letter" aria-hidden="true">{r.author.charAt(0).toUpperCase()}</span>
                      )}
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">
                          {r.authorUrl ? <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="text-reset">{r.author}</a> : r.author}
                        </div>
                        <div className="small text-muted">{r.when}</div>
                      </div>
                    </div>
                    <Stars value={r.rating} className="small" />
                    <p className="google-review-text small mt-2 mb-0">{r.text}</p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="small mt-2 d-inline-block">
                        Read on Google<span className="visually-hidden"> (review by {r.author})</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
              {data.reviewsUrl && (
                <a href={data.reviewsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-navy">
                  See all reviews on Google
                </a>
              )}
              <a href={data.writeReviewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-orange">
                <i className="bi bi-pencil-square me-1" aria-hidden="true" />Write a review
              </a>
              <span className="small text-muted ms-auto">Reviews from Google</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
