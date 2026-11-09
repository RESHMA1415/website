import { formatDateTime } from '../utils/format.js';

// Customer-facing tracking steps (PRD §13.12)
export const TRACKING_STEPS = [
  { status: 'confirmed', label: 'Order Confirmed' },
  { status: 'processing', label: 'Packed' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
];

// `history` = [{ status, at }] from the order
export default function OrderTimeline({ history = [] }) {
  const reached = new Map(history.map((h) => [h.status, h.at]));
  const failed = history.find((h) => h.status === 'delivery_failed');
  // A skipped step (e.g. shipped straight from confirmed) counts as done
  const lastIndex = Math.max(...TRACKING_STEPS.map((s, i) => (reached.has(s.status) ? i : -1)));
  return (
    <ul className="timeline">
      {TRACKING_STEPS.map((step, i) => {
        const at = reached.get(step.status);
        const done = i <= lastIndex;
        return (
          <li key={step.status} className={done ? 'done' : ''}>
            <span className="dot" />
            <div className={`fw-semibold ${done ? 'text-navy' : 'text-muted'}`}>{step.label}</div>
            <div className="small text-muted">{at ? formatDateTime(at) : done ? 'Done' : 'Pending'}</div>
          </li>
        );
      })}
      {failed && (
        <li className="failed">
          <span className="dot" />
          <div className="fw-semibold text-danger">Delivery unsuccessful</div>
          <div className="small text-muted">{formatDateTime(failed.at)} · we’ll contact you</div>
        </li>
      )}
    </ul>
  );
}
