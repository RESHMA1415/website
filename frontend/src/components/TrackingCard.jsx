// Courier name, tracking number and "Track on courier website" (PRD §13.12)
export default function TrackingCard({ shipping, title = 'Shipment' }) {
  if (!shipping?.trackingNumber) return null;
  return (
    <div className="tracking-card small">
      <div className="text-muted">{title}</div>
      <div className="fw-semibold">{shipping.courier} · {shipping.trackingNumber}</div>
      {shipping.trackingUrl && (
        <a className="btn btn-outline-navy btn-sm mt-2" href={shipping.trackingUrl} target="_blank" rel="noreferrer">
          Track on courier website <i className="bi bi-box-arrow-up-right ms-1" />
        </a>
      )}
    </div>
  );
}
