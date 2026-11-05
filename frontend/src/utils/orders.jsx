// What customers see for each order / payment status (PRD §8.1, §9.3)
export const ORDER_STATUS = {
  pending_payment: { label: 'Awaiting Payment', tone: 'warning' },
  confirmed: { label: 'Order Confirmed', tone: 'info' },
  processing: { label: 'Being Packed', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'primary' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'primary' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  return_requested: { label: 'Return Requested', tone: 'warning' },
  return_approved: { label: 'Return Approved', tone: 'info' },
  return_rejected: { label: 'Return Rejected', tone: 'danger' },
  returned: { label: 'Returned', tone: 'secondary' },
  refunded: { label: 'Refunded', tone: 'secondary' },
  exchanged: { label: 'Exchanged', tone: 'secondary' },
  delivery_failed: { label: 'Delivery Unsuccessful', tone: 'danger' },
};

export const PAYMENT_STATUS = {
  pending: 'Payment pending',
  paid: 'Paid online',
  failed: 'Payment failed',
  refund_initiated: 'Refund in progress',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
  cod_pending: 'Cash on Delivery: pay when it arrives',
  cod_collected: 'Paid (cash on delivery)',
};

export const PAYMENT_METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet', cod: 'Cash on Delivery', other: 'Online' };

export function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] || { label: status, tone: 'secondary' };
  return <span className={`badge rounded-pill text-bg-${s.tone}`}>{s.label}</span>;
}
