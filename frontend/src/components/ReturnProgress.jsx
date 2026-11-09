import { formatDateTime, formatINR } from '../utils/format.js';
import TrackingCard from './TrackingCard.jsx';

// Progress of each return/exchange request on an order (PRD §13.12)
export default function ReturnProgress({ returns = [] }) {
  if (!returns.length) return null;
  return (
    <div className="d-grid gap-3">
      {returns.map((r) => (
        <div key={r.id} className="return-card">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <div className="fw-semibold text-navy">{r.type === 'exchange' ? 'Exchange' : 'Return'} · {r.statusLabel}</div>
            <div className="small text-muted">Requested {formatDateTime(r.createdAt)}</div>
          </div>
          <div className="small mb-2">{r.items.map((i) => `${i.name}${i.optionLabel ? ` (${i.optionLabel})` : ''} × ${i.quantity}`).join(', ')}</div>
          {r.rejectionReason && <div className="small text-danger mb-2">Reason: {r.rejectionReason}</div>}
          {r.reversePickupTracking && <div className="small mb-2">Pickup tracking: {r.reversePickupTracking}</div>}
          {r.refundedAmount > 0 && <div className="small text-success mb-2">Refunded {formatINR(r.refundedAmount)}</div>}
          <TrackingCard shipping={r.replacementTracking} title="Replacement shipment" />
          <ul className="list-unstyled small text-muted mb-0 mt-2">
            {r.history.map((h, n) => <li key={n}>{formatDateTime(h.at)}: {h.label}{h.note ? ` (${h.note})` : ''}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
