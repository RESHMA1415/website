// Names and colours for order, payment and return statuses (PRD §8.1, §9.3, §10.5)
export const ORDER_STATUS = {
  pending_payment: ['Awaiting payment', 'muted'],
  confirmed: ['New', 'blue'],
  processing: ['Processing', 'orange'],
  shipped: ['Shipped', 'navy'],
  out_for_delivery: ['Out for delivery', 'navy'],
  delivered: ['Delivered', 'green'],
  cancelled: ['Cancelled', 'red'],
  return_requested: ['Return requested', 'orange'],
  return_approved: ['Return approved', 'blue'],
  return_rejected: ['Return rejected', 'red'],
  returned: ['Returned', 'muted'],
  refunded: ['Refunded', 'muted'],
  exchanged: ['Exchanged', 'muted'],
  delivery_failed: ['Delivery failed / RTO', 'red'],
};

export const PAYMENT_STATUS = {
  pending: ['Pending', 'muted'],
  paid: ['Paid', 'green'],
  failed: ['Failed', 'red'],
  refund_initiated: ['Refund needed', 'red'],
  refunded: ['Refunded', 'muted'],
  partially_refunded: ['Partly refunded', 'orange'],
  cod_pending: ['COD pending', 'orange'],
  cod_collected: ['COD collected', 'green'],
  cancelled: ['Not collected', 'muted'],
};

export const RETURN_STATUS = {
  requested: ['Requested', 'orange'],
  approved: ['Approved', 'blue'],
  rejected: ['Rejected', 'red'],
  pickup_scheduled: ['Pickup scheduled', 'navy'],
  received: ['Received', 'navy'],
  refunded: ['Refunded', 'green'],
  replacement_shipped: ['Replacement shipped', 'green'],
  closed: ['Closed', 'muted'],
};

export const METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet', cod: 'Cash on Delivery', other: 'Online' };

export function Pill({ map, value }) {
  const [label, tone] = map[value] || [value, 'muted'];
  return <span className={`status-pill tone-${tone}`}>{label}</span>;
}
