// Google reviews of the store's Google Business Profile, via the Places API (New).
// One request per refresh: rating, review count and the (at most 5) reviews Google
// chooses to share. Plain fetch, key from .env only.

// GOOGLE_PLACES_API_BASE is only for tests (a stand-in for Google)
const BASE = process.env.GOOGLE_PLACES_API_BASE || 'https://places.googleapis.com/v1/places';
const FIELDS = ['displayName', 'rating', 'userRatingCount', 'reviews', 'googleMapsUri', 'googleMapsLinks'].join(',');

export function googlePlacesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

// A Place ID looks like "ChIJN1t_tDeuEmsRUsoyG83frY4" (letters, digits, - and _)
export function validPlaceId(placeId) {
  return /^[A-Za-z0-9_-]{10,300}$/.test(String(placeId || ''));
}

export function writeReviewUrl(placeId) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Asks Google for the place's rating and reviews.
 * Returns { name, rating, count, mapsUrl, reviewsUrl, writeReviewUrl, reviews[] }; throws with a
 * plain-English message when Google refuses (bad key, wrong Place ID, API not enabled…).
 */
export async function fetchPlaceReviews(placeId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(placeId)}?languageCode=en&regionCode=IN`, {
    headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': FIELDS },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = data.error?.status || response.status;
    const reason =
      status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT'
        ? 'Google could not find this Place ID.'
        : status === 'PERMISSION_DENIED'
          ? 'Google refused the API key (check the key, that "Places API (New)" is enabled and billing is on).'
          : `Google answered ${status}.`;
    throw new Error(`${reason}${data.error?.message ? ` (${data.error.message})` : ''}`);
  }
  return {
    name: data.displayName?.text || '',
    rating: Number(data.rating) || 0,
    count: Number(data.userRatingCount) || 0,
    mapsUrl: data.googleMapsUri || '',
    reviewsUrl: data.googleMapsLinks?.reviewsUri || data.googleMapsUri || '',
    writeReviewUrl: data.googleMapsLinks?.writeAReviewUri || writeReviewUrl(placeId),
    reviews: (data.reviews || []).map((r) => ({
      author: r.authorAttribution?.displayName || 'Google user',
      authorUrl: r.authorAttribution?.uri || '',
      photoUrl: r.authorAttribution?.photoUri || '',
      rating: Number(r.rating) || 0,
      text: r.text?.text || r.originalText?.text || '',
      when: r.relativePublishTimeDescription || '',
      publishedAt: r.publishTime || null,
      url: r.googleMapsUri || '',
    })),
  };
}
