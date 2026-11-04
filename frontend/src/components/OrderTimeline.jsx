import { formatDate } from '../utils/format.js';

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
  return (
    <ul className="timeline">
      {TRACKING_STEPS.map((step) => {
        const at = reached.get(step.status);
        return (
          <li key={step.status} className={at ? 'done' : ''}>
            <span className="dot" />
            <div className={`fw-semibold ${at ? 'text-navy' : 'text-muted'}`}>{step.label}</div>
            <div className="small text-muted">{at ? formatDate(at) : 'Pending'}</div>
          </li>
        );
      })}
    </ul>
  );
}
