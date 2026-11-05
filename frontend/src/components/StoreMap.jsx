// Store location: an interactive Google map plus a "Get Directions" button.
// Both come from Business Settings (store.mapQuery / store.address and
// store.mapLink). On phones the button opens the Google Maps app.
export function mapEmbedUrl(store) {
  const query = (store.mapQuery || store.address || '').trim();
  return query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed` : '';
}

export function DirectionsButton({ store, className = 'btn btn-orange' }) {
  if (!store.mapLink) return null;
  return (
    <a className={className} href={store.mapLink} target="_blank" rel="noopener noreferrer">
      <i className="bi bi-sign-turn-right me-2" />Get Directions
    </a>
  );
}

export default function StoreMap({ store, height = 220, className = '' }) {
  const src = mapEmbedUrl(store);
  if (!src) return null;
  return (
    <div className={`store-map ${className}`} style={{ height }}>
      <iframe
        title={`${store.name || 'Store'} location on Google Maps`}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
