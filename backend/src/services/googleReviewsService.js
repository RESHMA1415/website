import { fetchPlaceReviews, googlePlacesConfigured, validPlaceId } from '../integrations/googlePlaces.js';
import { getSettings } from './settingsService.js';

// Google reviews on the homepage (owner request, 12 Nov 2026).
// Kept in memory only and refreshed twice a day, so Google is asked about 60 times a
// month (well inside the free allowance) and nothing from Google is stored in the database.
export const GOOGLE_REVIEW_RULES = {
  refreshHours: 12,
  retryMinutes: 15, // after a failed refresh
};

let cache = { placeId: '', fetchedAt: 0, data: null, error: '', failedAt: 0 };
let inFlight = null;

async function refresh(placeId) {
  try {
    const data = await fetchPlaceReviews(placeId);
    cache = { placeId, fetchedAt: Date.now(), data, error: '', failedAt: 0 };
  } catch (err) {
    console.error('[google reviews] refresh failed:', err.message);
    // Keep the last good copy (if it is for the same place) and try again later
    cache = { ...cache, placeId, data: cache.placeId === placeId ? cache.data : null, error: err.message, failedAt: Date.now() };
  }
}

async function load(placeId, { force = false } = {}) {
  const now = Date.now();
  const fresh = cache.placeId === placeId && cache.data && now - cache.fetchedAt < GOOGLE_REVIEW_RULES.refreshHours * 3600000;
  const waiting = cache.placeId === placeId && cache.failedAt && now - cache.failedAt < GOOGLE_REVIEW_RULES.retryMinutes * 60000;
  if (!force && (fresh || waiting)) return;
  if (!inFlight) inFlight = refresh(placeId).finally(() => { inFlight = null; });
  await inFlight;
}

/** What the homepage shows. Never throws: an empty answer just hides the section. */
export async function publicGoogleReviews() {
  const { googleReviews } = await getSettings();
  const placeId = googleReviews?.placeId || '';
  if (!googleReviews?.enabled || !validPlaceId(placeId) || !googlePlacesConfigured()) return { enabled: false };
  await load(placeId);
  const d = cache.placeId === placeId ? cache.data : null;
  if (!d || !d.count) return { enabled: false };
  return {
    enabled: true,
    rating: d.rating,
    count: d.count,
    reviewsUrl: d.reviewsUrl,
    writeReviewUrl: d.writeReviewUrl,
    // Shown as Google sends them (good and bad); a star-only review without text is skipped
    reviews: d.reviews.filter((r) => r.text),
  };
}

/** Admin status: is the key set, does the Place ID work, what did Google say. */
export async function googleReviewsStatus({ check = false } = {}) {
  const { googleReviews } = await getSettings();
  const placeId = googleReviews?.placeId || '';
  const status = { keyConnected: googlePlacesConfigured(), placeIdSet: validPlaceId(placeId), enabled: Boolean(googleReviews?.enabled) };
  if (status.keyConnected && status.placeIdSet) {
    await load(placeId, { force: check });
    if (cache.placeId === placeId) {
      status.error = cache.error && (!cache.data || cache.failedAt > cache.fetchedAt) ? cache.error : '';
      if (cache.data) Object.assign(status, { name: cache.data.name, rating: cache.data.rating, count: cache.data.count, shown: cache.data.reviews.filter((r) => r.text).length, checkedAt: new Date(cache.fetchedAt) });
    }
  }
  return status;
}
