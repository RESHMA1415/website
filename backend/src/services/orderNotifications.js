import { env } from '../config/env.js';
import { sendEmail } from '../integrations/email.js';
import { User } from '../models/index.js';
import { getSettings } from './settingsService.js';

// Order, return and refund messages (PRD §12.2). Email goes through the email
// integration (log-only until Phase 7, which also adds WhatsApp). Sending never
// throws and is never awaited by the action that triggers it.

export const formatINR = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
export const optionText = (o = {}) => [o.colour, o.size, o.shade, o.volume].filter(Boolean).join(' / ');
const itemLine = (i, qty = i.quantity) => `- ${i.name}${optionText(i.options) ? ` (${optionText(i.options)})` : ''} × ${qty}`;
const orderLink = (order) => `${env.storeUrl}/account/orders/${order.orderNumber}`;

async function toCustomer(order, event, subject, body) {
  const [user, settings] = await Promise.all([User.findById(order.user, { name: 1, email: 1 }).lean(), getSettings()]);
  if (!user?.email) return; // account deleted: nobody to tell
  await sendEmail({
    event,
    to: user.email,
    order: order._id,
    action: { label: 'View your order', url: orderLink(order) },
    subject,
    text: `Hi ${user.name},\n\n${body}\n\nView your order: ${orderLink(order)}\n\nNeed help? Reply to this email or WhatsApp us on ${settings.store.phone || settings.store.whatsappNumber || ''}.\n${settings.store.name}`,
  });
}

async function toAdmin(event, subject, text, action) {
  const settings = await getSettings();
  if (!settings.notifications?.adminAlertEmail) return;
  await sendEmail({ event, to: settings.notifications.adminAlertEmail, subject, text, action });
}

function fire(task) {
  Promise.resolve()
    .then(task)
    .catch((err) => console.error('Order notification failed', err));
}

const MESSAGES = {
  processing: (o) => ['order_processing', `We're packing your order ${o.orderNumber}`, `Good news! We're packing your order ${o.orderNumber}. We'll let you know when it ships.`],
  shipped: (o) => [
    'order_shipped',
    `Shipped: ${o.orderNumber}`,
    `Your order ${o.orderNumber} is on its way.\n\nCourier: ${o.shipping?.courier}\nTracking number: ${o.shipping?.trackingNumber}${o.shipping?.trackingUrl ? `\nTrack it here: ${o.shipping.trackingUrl}` : ''}\n\n${o.items.map((i) => itemLine(i)).join('\n')}`,
  ],
  out_for_delivery: (o) => [
    'order_out_for_delivery',
    `Out for delivery today: ${o.orderNumber}`,
    `Your order ${o.orderNumber} is out for delivery today.${o.paymentMethod === 'cod' && o.paymentStatus === 'cod_pending' ? ` Please keep ${formatINR(o.total)} ready to pay on delivery.` : ''}`,
  ],
  delivered: (o) => [
    'order_delivered',
    `Delivered: ${o.orderNumber}`,
    `Your order ${o.orderNumber} has been delivered. We hope you love it!\n\nIf something isn't right, you can request a return or exchange from My Orders within the return window.`,
  ],
  delivery_failed: (o) => [
    'order_delivery_failed',
    `Delivery unsuccessful: ${o.orderNumber}`,
    `The courier couldn't deliver your order ${o.orderNumber}, and it is coming back to us. We'll contact you shortly.`,
  ],
};

export function notifyStatus(order) {
  const build = MESSAGES[order.status];
  if (!build) return;
  fire(() => toCustomer(order, ...build(order)));
}

export function notifyCancelled(order, refund) {
  const refundText =
    order.paymentMethod === 'cod'
      ? 'As this was a Cash on Delivery order, nothing was charged.'
      : refund?.ok
        ? `A full refund of ${formatINR(refund.amount)} has been started to your original payment method. It usually reaches you in 5–7 business days.`
        : 'Your refund to the original payment method will be started within 2 business days. It then takes 5–7 business days to reach you.';
  fire(() =>
    toCustomer(order, 'order_cancelled', `Order cancelled: ${order.orderNumber}`, `Your order ${order.orderNumber} has been cancelled.\nReason: ${order.cancellation?.reason || '—'}\n\n${refundText}`),
  );
  fire(() =>
    toAdmin(
      'order_cancelled_admin',
      `Order cancelled: ${order.orderNumber} (${order.cancellation?.by === 'customer' ? 'by customer' : 'by admin'})`,
      `Order ${order.orderNumber} (${formatINR(order.total)}, ${order.paymentMethod === 'cod' ? 'COD' : 'paid online'}) was cancelled.\nReason: ${order.cancellation?.reason || '—'}\n\n${order.items.map((i) => itemLine(i)).join('\n')}\n\nThe items have been put back in stock.${order.paymentMethod === 'online' && !refund?.ok ? '\nThe automatic refund did not go through: please refund it from the order page.' : ''}`,
    ),
  );
}

export function notifyRefund(order, amount, reference) {
  fire(() =>
    toCustomer(
      order,
      'refund_processed',
      `Refund of ${formatINR(amount)} for ${order.orderNumber}`,
      `We've refunded ${formatINR(amount)} for your order ${order.orderNumber}.${reference ? `\nReference: ${reference}` : ''}\n\n${order.paymentMethod === 'cod' ? 'It was sent to the UPI ID or bank account you gave us.' : 'It goes back to your original payment method and usually arrives in 5–7 business days.'}`,
    ),
  );
}

const RETURN_TYPE = { return: 'return', exchange: 'exchange' };

export function notifyReturnRequested(order, request, items) {
  const lines = items.map((x) => itemLine(x.item, x.quantity)).join('\n');
  fire(() =>
    toCustomer(
      order,
      'return_requested',
      `We received your ${RETURN_TYPE[request.type]} request for ${order.orderNumber}`,
      `We've received your ${RETURN_TYPE[request.type]} request for order ${order.orderNumber}:\n\n${lines}\n\nWe'll review it within 2 business days and let you know.`,
    ),
  );
  fire(() =>
    toAdmin('return_requested_admin', `New ${RETURN_TYPE[request.type]} request: ${order.orderNumber}`, `A customer asked for a ${RETURN_TYPE[request.type]} on order ${order.orderNumber}.\nReason: ${request.reason}\n\n${lines}\n\nOpen Returns & Exchanges in the admin panel to approve or reject it.`),
  );
}

const RETURN_MESSAGES = {
  approved: (o, r) => [`Your ${r.type} request for ${o.orderNumber} is approved`, `Your ${r.type} request for order ${o.orderNumber} has been approved. We'll arrange a pickup from your address and let you know the details.`],
  rejected: (o, r) => [`Update on your ${r.type} request for ${o.orderNumber}`, `Sorry, we couldn't accept your ${r.type} request for order ${o.orderNumber}.\nReason: ${r.rejectionReason}\n\nIf you have questions, just reply to this email.`],
  pickup_scheduled: (o, r) => [`Pickup arranged for ${o.orderNumber}`, `A courier will collect the item(s) for your ${r.type} on order ${o.orderNumber}.${r.reversePickupTracking ? `\nPickup tracking: ${r.reversePickupTracking}` : ''}\nPlease keep them packed with their tags.`],
  received: (o, r) => [`We received your returned item(s) for ${o.orderNumber}`, `We've received the item(s) from your ${r.type} on order ${o.orderNumber}. ${r.type === 'exchange' ? 'Your replacement will be sent soon.' : 'Your refund will be processed shortly.'}`],
  replacement_shipped: (o, r) => [
    `Your replacement for ${o.orderNumber} has shipped`,
    `Your replacement for order ${o.orderNumber} is on its way.\nCourier: ${r.replacementTracking?.courier}\nTracking number: ${r.replacementTracking?.trackingNumber}${r.replacementTracking?.trackingUrl ? `\nTrack it here: ${r.replacementTracking.trackingUrl}` : ''}`,
  ],
};

export function notifyReturnStatus(order, request) {
  const build = RETURN_MESSAGES[request.status];
  if (!build) return;
  fire(() => toCustomer(order, `return_${request.status}`, ...build(order, request)));
}
