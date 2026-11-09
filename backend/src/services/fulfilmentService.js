import { razorpayConfigured, refundPayment as razorpayRefund } from '../integrations/razorpay.js';
import { Order, Payment, Product, ReturnRequest, StockMovement, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanLink, cleanText, escapeRegex, pageParams, toBool } from '../utils/text.js';
import { cleanEmail, cleanMobile } from './customerAuthService.js';
import { notifyCancelled, notifyRefund, notifyStatus, optionText } from './orderNotifications.js';
import { CANCELLABLE_STATUSES, PLACED, customerReturn, returnWindowEnd } from './orderService.js';
import { getSettings } from './settingsService.js';

// Order management, cancellations, refunds and tracking (PRD §8, §9.4, §10.1,
// §13.12, §14.7). Status only moves forward; each move is a compare-and-set on
// the current status, so two clicks (or admin + customer) can't both apply.

// ---------- Stock back in (cancel, courier return, accepted returns) ----------
export async function restoreStock(order, items, { reason, note }) {
  const moved = [];
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity, unitsSold: -item.quantity } },
      { new: true, projection: { variants: { $elemMatch: { _id: item.variantId } } } },
    ).lean();
    // A deleted product or option can't take stock back; nothing to record
    if (updated) moved.push({ item, stockAfter: updated.variants[0].stock });
  }
  if (moved.length) {
    await StockMovement.insertMany(
      moved.map(({ item, stockAfter }) => ({
        product: item.product, variantId: item.variantId, sku: item.sku, change: item.quantity, stockAfter, reason, order: order._id, note: note || order.orderNumber,
      })),
    );
  }
  return moved.length;
}

// ---------- Refunds (PRD §9.4) ----------
const REFUNDABLE_ONLINE = ['paid', 'partially_refunded', 'refund_initiated'];

function paymentRefundState(payment, refundedTotal) {
  return refundedTotal >= payment.amount ? 'refunded' : 'partially_refunded';
}

/**
 * Refunds part or all of one payment. Online payments go back through Razorpay;
 * COD refunds are paid by hand (UPI/bank) and need the transaction reference.
 * The amount is reserved on the payment first (atomically), so two refunds can
 * never add up to more than was paid.
 */
export async function refundOnePayment(payment, { amount, reason, manualReference, by = 'admin' }) {
  const refundable = payment.amount - (payment.refundedAmount || 0);
  if (!(amount > 0)) throw new HttpError(400, 'Please enter the amount to refund.');
  if (amount > refundable) throw new HttpError(400, `You can refund at most ₹${refundable.toLocaleString('en-IN')} on this payment.`);
  const isCod = payment.provider === 'cod';
  if (isCod && !manualReference) throw new HttpError(400, 'Please enter the UPI or bank transaction reference for this refund.');
  if (isCod && payment.status !== 'cod_collected' && payment.status !== 'partially_refunded') {
    throw new HttpError(409, 'This Cash on Delivery order has not been paid, so there is nothing to refund.');
  }
  if (!isCod && !REFUNDABLE_ONLINE.includes(payment.status)) throw new HttpError(409, 'This payment can’t be refunded.');
  if (!isCod && !razorpayConfigured()) throw new HttpError(503, 'Online refunds need the Razorpay keys. Please add them first.');

  // Reserve the amount
  const reserved = await Payment.findOneAndUpdate(
    { _id: payment._id, $expr: { $lte: [{ $add: [{ $ifNull: ['$refundedAmount', 0] }, amount] }, '$amount'] } },
    { $inc: { refundedAmount: amount }, $push: { refunds: { amount, reason, manualReference, by, state: isCod ? 'done' : 'processing' } } },
    { new: true },
  );
  if (!reserved) throw new HttpError(409, 'This payment was refunded in the meantime. Please reload the page.');
  const entry = reserved.refunds[reserved.refunds.length - 1];

  let razorpayRefundId;
  if (!isCod) {
    try {
      razorpayRefundId = (await razorpayRefund(payment.razorpayPaymentId, amount, { reason: reason || 'Refund' })).id;
    } catch (err) {
      await Payment.updateOne({ _id: payment._id }, { $inc: { refundedAmount: -amount }, $pull: { refunds: { _id: entry._id } } });
      console.error('Razorpay refund failed', err);
      throw new HttpError(502, `Razorpay couldn’t make the refund: ${err.message}. Nothing was refunded; please try again.`);
    }
  }
  const status = paymentRefundState(reserved, reserved.refundedAmount);
  await Payment.updateOne(
    { _id: payment._id, 'refunds._id': entry._id },
    { status, $set: { 'refunds.$.state': 'done', 'refunds.$.razorpayRefundId': razorpayRefundId }, $unset: { failureReason: 1 } },
  );
  return { amount, status, reference: razorpayRefundId || manualReference };
}

// The payment of an order that money can be refunded from
async function refundablePayment(order) {
  if (order.paymentMethod === 'cod') return Payment.findOne({ order: order._id, provider: 'cod' }).sort({ createdAt: -1 });
  // The first successful payment is the order's own; any later one was a duplicate
  return Payment.findOne({ order: order._id, provider: 'razorpay', status: { $in: REFUNDABLE_ONLINE } }).sort({ createdAt: 1 });
}

// Refunds money on an order and keeps the order's totals in step
export async function refundOrder(order, { amount, reason, manualReference, by = 'admin', notify = true }) {
  const payment = await refundablePayment(order);
  if (!payment) throw new HttpError(409, order.paymentMethod === 'cod' ? 'No Cash on Delivery payment was recorded for this order.' : 'There is no paid online payment on this order to refund.');
  const result = await refundOnePayment(payment, { amount, reason, manualReference, by });
  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    {
      $inc: { refundedAmount: amount },
      paymentStatus: result.status,
      $push: { internalNotes: { text: `Refund ₹${amount.toLocaleString('en-IN')}${result.reference ? ` (ref ${result.reference})` : ''}${reason ? `: ${reason}` : ''}` } },
    },
    { new: true },
  );
  if (notify) notifyRefund(updated, amount, result.reference);
  return { ...result, order: updated };
}

// ---------- Cancelling (PRD §10.1) ----------
export const CANCEL_REASONS = {
  changed_mind: 'Changed my mind',
  ordered_by_mistake: 'Ordered by mistake',
  found_cheaper: 'Found it cheaper elsewhere',
  delivery_too_slow: 'Delivery is too slow',
  other: 'Other',
};

async function cancel(filter, { reason, by }) {
  const order = await Order.findOneAndUpdate(
    { ...filter, status: { $in: CANCELLABLE_STATUSES } },
    {
      status: 'cancelled',
      cancellation: { reason, by, at: new Date() },
      $push: { statusHistory: { status: 'cancelled', by, note: reason } },
    },
    { new: true },
  );
  if (!order) {
    const current = await Order.findOne(filter, { status: 1 }).lean();
    if (!current) throw new HttpError(404, 'We couldn’t find that order.');
    if (current.status === 'cancelled') throw new HttpError(409, 'This order is already cancelled.');
    throw new HttpError(409, 'This order has already shipped, so it can’t be cancelled. You can request a return once it is delivered.');
  }
  await restoreStock(order, order.items, { reason: 'cancellation', note: `${order.orderNumber} cancelled` });

  let refund = null;
  if (order.paymentMethod === 'cod') {
    await Promise.all([
      Order.updateOne({ _id: order._id }, { paymentStatus: 'cancelled' }),
      Payment.updateMany({ order: order._id, provider: 'cod', status: 'cod_pending' }, { status: 'cancelled' }),
    ]);
    order.paymentStatus = 'cancelled';
  } else {
    // Online: full refund straight away (PRD §6.9). If Razorpay says no, the
    // admin sees "Refund in progress" and refunds from the order page.
    const payment = await refundablePayment(order);
    const amount = payment ? payment.amount - (payment.refundedAmount || 0) : 0;
    if (amount > 0) {
      try {
        const done = await refundOrder(order, { amount, reason: 'Order cancelled', by: 'system', notify: false });
        refund = { ok: true, amount };
        order.paymentStatus = done.status;
      } catch (err) {
        console.error(`Refund for cancelled order ${order.orderNumber} failed`, err.message);
        await Order.updateOne({ _id: order._id }, { paymentStatus: 'refund_initiated', $push: { internalNotes: { text: `Automatic refund failed: ${err.message}` } } });
        await Payment.updateOne({ _id: payment._id }, { status: 'refund_initiated', failureReason: `Refund after cancellation failed: ${err.message}` });
        order.paymentStatus = 'refund_initiated';
        refund = { ok: false, amount };
      }
    }
  }
  notifyCancelled(order, refund);
  return { order, refund };
}

export async function cancelMyOrder(userId, orderNumber, body = {}) {
  const code = body.reason;
  if (!CANCEL_REASONS[code]) throw new HttpError(400, 'Please choose a reason for cancelling.');
  const comment = cleanText(body.comment, 300);
  const reason = `${CANCEL_REASONS[code]}${comment ? `: ${comment}` : ''}`;
  const { order, refund } = await cancel({ orderNumber: cleanText(orderNumber, 30), user: userId }, { reason, by: 'customer' });
  return { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, refund };
}

export async function cancelOrderByAdmin(orderNumber, body = {}) {
  const reason = cleanText(body.reason, 300);
  if (!reason) throw new HttpError(400, 'Please give a reason. The customer will see it.');
  const { order, refund } = await cancel({ orderNumber: cleanText(orderNumber, 30) }, { reason, by: 'admin' });
  return { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, refund };
}

// ---------- Moving an order forward (PRD §8) ----------
const MOVES = {
  processing: ['confirmed'],
  shipped: ['confirmed', 'processing'],
  out_for_delivery: ['shipped'],
  delivered: ['shipped', 'out_for_delivery'],
  delivery_failed: ['shipped', 'out_for_delivery'],
};

const STATUS_NAMES = {
  confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
  delivery_failed: 'Delivery Failed / RTO', cancelled: 'Cancelled',
};

function cleanShipping(body, current = {}) {
  const courier = cleanText(body.courier ?? current.courier, 60);
  const trackingNumber = cleanText(body.trackingNumber ?? current.trackingNumber, 60);
  if (!courier) throw new HttpError(400, 'Please enter the courier name.');
  if (!trackingNumber) throw new HttpError(400, 'Please enter the tracking number.');
  const rawUrl = body.trackingUrl ?? current.trackingUrl;
  let trackingUrl = '';
  if (rawUrl) {
    trackingUrl = cleanLink(rawUrl);
    if (!/^https?:\/\//i.test(trackingUrl)) throw new HttpError(400, 'The tracking link must start with http:// or https://');
  }
  return { courier, trackingNumber, trackingUrl };
}

async function moveOrder(filter, status, body) {
  const from = MOVES[status];
  if (!from) throw new HttpError(400, 'That status change isn’t possible.');
  const note = cleanText(body.note, 300);
  const now = new Date();
  const set = { status };
  if (status === 'shipped') {
    const s = cleanShipping(body);
    Object.assign(set, { 'shipping.courier': s.courier, 'shipping.trackingNumber': s.trackingNumber, 'shipping.trackingUrl': s.trackingUrl, 'shipping.shippedAt': now });
  }
  if (status === 'delivered') set['shipping.deliveredAt'] = now;

  let order = await Order.findOneAndUpdate(
    { ...filter, status: { $in: from } },
    { ...set, $push: { statusHistory: { status, by: 'admin', note, at: now } } },
    { new: true },
  );
  if (!order) {
    const current = await Order.findOne(filter, { status: 1, orderNumber: 1 }).lean();
    if (!current) throw new HttpError(404, 'We couldn’t find that order.');
    throw new HttpError(409, `Order ${current.orderNumber} is ${STATUS_NAMES[current.status] || current.status}, so it can’t be marked ${STATUS_NAMES[status]}. Orders only move forward.`);
  }

  if (status === 'delivered' && order.paymentMethod === 'cod') {
    // PRD §8.2: COD becomes "Paid (COD collected)" on delivery
    await Payment.updateMany({ order: order._id, provider: 'cod', status: 'cod_pending' }, { status: 'cod_collected' });
    order = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: 'cod_pending' }, { paymentStatus: 'cod_collected' }, { new: true }) || order;
  }
  if (status === 'delivery_failed') {
    if (order.paymentMethod === 'cod') {
      await Payment.updateMany({ order: order._id, provider: 'cod', status: 'cod_pending' }, { status: 'cancelled' });
      order = await Order.findOneAndUpdate({ _id: order._id }, { paymentStatus: 'cancelled' }, { new: true });
    }
    if (toBool(body.restock)) order = await markRtoReceived(order);
  }
  notifyStatus(order);
  return order;
}

// Courier parcel back with us: items go back on sale once (PRD §8.2)
async function markRtoReceived(order) {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: 'delivery_failed', 'rto.restocked': { $ne: true } },
    { rto: { restocked: true, restockedAt: new Date() }, $push: { internalNotes: { text: 'Returned parcel received; items put back in stock' } } },
    { new: true },
  );
  if (!claimed) throw new HttpError(409, 'These items were already put back in stock.');
  await restoreStock(claimed, claimed.items, { reason: 'rto', note: `${claimed.orderNumber} returned by courier` });
  return claimed;
}

export async function updateOrderStatus(orderNumber, body = {}) {
  const order = await moveOrder({ orderNumber: cleanText(orderNumber, 30) }, body.status, body);
  return getOrderForAdmin(order.orderNumber);
}

export async function rtoReceived(orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30) });
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  if (order.status !== 'delivery_failed') throw new HttpError(409, 'Only orders marked “Delivery failed” can be received back.');
  await markRtoReceived(order);
  return getOrderForAdmin(order.orderNumber);
}

// Fix a typo in the courier details after shipping
export async function updateShipping(orderNumber, body = {}) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30) });
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  if (!['shipped', 'out_for_delivery', 'delivered', 'delivery_failed'].includes(order.status)) throw new HttpError(409, 'Add courier details by marking the order as Shipped.');
  const s = cleanShipping(body, order.shipping);
  await Order.updateOne(
    { _id: order._id },
    { 'shipping.courier': s.courier, 'shipping.trackingNumber': s.trackingNumber, 'shipping.trackingUrl': s.trackingUrl, $push: { internalNotes: { text: `Courier details updated: ${s.courier} ${s.trackingNumber}` } } },
  );
  return getOrderForAdmin(order.orderNumber);
}

// Several orders → Processing at once (PRD §14.7 bulk action)
export async function bulkMarkProcessing(body = {}) {
  const numbers = Array.isArray(body.orderNumbers) ? body.orderNumbers.slice(0, 200).map((n) => cleanText(n, 30)) : [];
  if (!numbers.length) throw new HttpError(400, 'Please select at least one order.');
  let moved = 0;
  const skipped = [];
  for (const orderNumber of numbers) {
    try {
      await moveOrder({ orderNumber }, 'processing', {});
      moved += 1;
    } catch (err) {
      skipped.push(`${orderNumber}: ${err.message}`);
    }
  }
  return { moved, skipped };
}

// Several orders → Shipped at once, each with its own courier and tracking number
export async function bulkMarkShipped(body = {}) {
  const rows = Array.isArray(body.shipments) ? body.shipments.slice(0, 100) : [];
  if (!rows.length) throw new HttpError(400, 'Please add at least one order to ship.');
  const shipped = [];
  const skipped = [];
  const seen = new Set();
  for (const row of rows) {
    const orderNumber = cleanText(row?.orderNumber, 30);
    if (!orderNumber || seen.has(orderNumber)) continue;
    seen.add(orderNumber);
    try {
      await moveOrder({ orderNumber }, 'shipped', { courier: row.courier, trackingNumber: row.trackingNumber, trackingUrl: row.trackingUrl });
      shipped.push(orderNumber);
    } catch (err) {
      skipped.push({ orderNumber, reason: err.message });
    }
  }
  return { shipped, skipped };
}

export async function addInternalNote(orderNumber, body = {}) {
  const text = cleanText(body.text, 1000);
  if (!text) throw new HttpError(400, 'Please write the note.');
  const result = await Order.updateOne({ orderNumber: cleanText(orderNumber, 30) }, { $push: { internalNotes: { text, at: new Date() } } });
  if (!result.matchedCount) throw new HttpError(404, 'We couldn’t find that order.');
  return getOrderForAdmin(orderNumber);
}

export async function refundOrderByAdmin(orderNumber, body = {}) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30) });
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  const amount = Math.round(Number(body.amount));
  await refundOrder(order, { amount, reason: cleanText(body.reason, 200) || 'Refund', manualReference: cleanText(body.manualReference, 80) });
  return getOrderForAdmin(order.orderNumber);
}

// ---------- Admin order list (PRD §14.7) ----------
const RETURN_STATUSES = ['return_requested', 'return_approved', 'return_rejected', 'returned', 'refunded', 'exchanged', 'delivery_failed'];
export const ORDER_TABS = {
  new: { status: 'confirmed' },
  processing: { status: 'processing' },
  shipped: { status: { $in: ['shipped', 'out_for_delivery'] } },
  delivered: { status: 'delivered' },
  cancelled: { status: 'cancelled' },
  returns: { status: { $in: RETURN_STATUSES } },
  all: {},
};

function indiaDay(value, endOfDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const start = new Date(`${value}T00:00:00+05:30`);
  return endOfDay ? new Date(start.getTime() + 86400000) : start;
}

async function adminOrderFilter(query) {
  const filter = { ...PLACED };
  if (['online', 'cod'].includes(query.paymentMethod)) filter.paymentMethod = query.paymentMethod;
  if (query.paymentStatus) filter.paymentStatus = cleanText(query.paymentStatus, 30);
  const from = indiaDay(query.from);
  const to = indiaDay(query.to, true);
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  const q = cleanText(query.q, 80);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }, { mobile: pattern }] }, { _id: 1 }).limit(200).lean();
    filter.$or = [{ orderNumber: pattern }, { 'address.fullName': pattern }, { 'address.mobile': pattern }, { user: { $in: users.map((u) => u._id) } }];
  }
  return filter;
}

export async function listOrdersForAdmin(query = {}) {
  const tab = ORDER_TABS[query.tab] ? query.tab : 'all';
  const base = await adminOrderFilter(query);
  const filter = { ...base, ...ORDER_TABS[tab] };
  const { page, limit, skip } = pageParams(query, { defaultLimit: 25, maxLimit: 100 });
  const [orders, total, byStatus] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const count = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
  const sum = (list) => list.reduce((s, k) => s + (count[k] || 0), 0);
  const counts = {
    new: sum(['confirmed']),
    processing: sum(['processing']),
    shipped: sum(['shipped', 'out_for_delivery']),
    delivered: sum(['delivered']),
    cancelled: sum(['cancelled']),
    returns: sum(RETURN_STATUSES),
    all: Object.values(count).reduce((a, b) => a + b, 0),
  };
  return {
    items: orders.map((o) => ({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      customer: o.address?.fullName,
      mobile: o.address?.mobile,
      city: o.address?.city,
      itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
      total: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
  };
}

// ---------- Admin order page ----------
function nextActions(order) {
  const s = order.status;
  return {
    processing: MOVES.processing.includes(s),
    shipped: MOVES.shipped.includes(s),
    out_for_delivery: MOVES.out_for_delivery.includes(s),
    delivered: MOVES.delivered.includes(s),
    delivery_failed: MOVES.delivery_failed.includes(s),
    rtoReceived: s === 'delivery_failed' && !order.rto?.restocked,
    cancel: CANCELLABLE_STATUSES.includes(s),
    editShipping: ['shipped', 'out_for_delivery', 'delivered', 'delivery_failed'].includes(s),
  };
}

export async function getOrderForAdmin(orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30) }).lean();
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  const [user, payments, returns, settings, orderCount] = await Promise.all([
    User.findById(order.user, { name: 1, email: 1, mobile: 1, isBlocked: 1, createdAt: 1 }).lean(),
    Payment.find({ order: order._id }).sort({ createdAt: 1 }).lean(),
    ReturnRequest.find({ order: order._id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
    Order.countDocuments({ user: order.user, ...PLACED }),
  ]);
  const refundable = payments
    .filter((p) => (p.provider === 'cod' ? ['cod_collected', 'partially_refunded'].includes(p.status) : REFUNDABLE_ONLINE.includes(p.status)))
    .reduce((s, p) => s + p.amount - (p.refundedAmount || 0), 0);
  return {
    ...order,
    items: order.items.map((i) => ({ ...i, optionLabel: optionText(i.options) })),
    customer: user ? { ...user, orderCount } : null,
    payments: payments.map((p) => ({
      _id: p._id, provider: p.provider, method: p.method, amount: p.amount, status: p.status, razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId, failureReason: p.failureReason, refundedAmount: p.refundedAmount || 0,
      refunds: (p.refunds || []).filter((r) => r.state !== 'processing'), createdAt: p.createdAt,
    })),
    returns: returns.map((r) => ({ ...customerReturn(r, order), statusRaw: r.status })),
    actions: { ...nextActions(order), refund: refundable > 0 },
    refundable,
    returnWindowEndsAt: returnWindowEnd(order, settings),
    onlineRefundsAvailable: razorpayConfigured(),
  };
}

// Several orders for printing packing slips (PRD §8.3)
export async function packingSlips(query = {}) {
  const numbers = String(query.orders || '').split(',').map((n) => cleanText(n, 30)).filter(Boolean).slice(0, 100);
  if (!numbers.length) throw new HttpError(400, 'Please choose the orders to print.');
  const [orders, settings] = await Promise.all([Order.find({ orderNumber: { $in: numbers } }).lean(), getSettings()]);
  const byNumber = new Map(orders.map((o) => [o.orderNumber, o]));
  return {
    store: { name: settings.store.name, phone: settings.store.phone, email: settings.store.email, address: settings.store.address },
    orders: numbers.filter((n) => byNumber.has(n)).map((n) => {
      const o = byNumber.get(n);
      return {
        orderNumber: o.orderNumber, createdAt: o.createdAt, status: o.status, address: o.address, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
        items: o.items.map((i) => ({ name: i.name, optionLabel: optionText(i.options), sku: i.sku, quantity: i.quantity, price: i.price })),
        subtotal: o.subtotal, deliveryCharge: o.deliveryCharge, codCharge: o.codCharge, total: o.total,
        codToCollect: o.paymentMethod === 'cod' && o.paymentStatus === 'cod_pending' ? o.total : 0,
        shipping: o.shipping,
      };
    }),
  };
}

// ---------- Public "Track Order" (PRD §13.12) ----------
const trackLog = new Map(); // ip -> [timestamps]
function limitTracking(ip) {
  if (!ip) return;
  const now = Date.now();
  const recent = (trackLog.get(ip) || []).filter((t) => now - t < 15 * 60000);
  if (recent.length >= 30) throw new HttpError(429, 'Too many tracking requests. Please try again in a few minutes.');
  recent.push(now);
  trackLog.set(ip, recent);
  if (trackLog.size > 5000) trackLog.clear();
}

export async function trackOrder(body = {}, { ip } = {}) {
  limitTracking(ip);
  const orderNumber = cleanText(body.orderNumber, 30).toUpperCase();
  const contact = cleanText(body.contact, 120);
  if (!orderNumber || !contact) throw new HttpError(400, 'Please enter your order number and the mobile number or email used for the order.');
  const notFound = new HttpError(404, 'We couldn’t find an order with these details. Please check the order number and the mobile number or email.');
  const order = await Order.findOne({ orderNumber, ...PLACED }).lean();
  if (!order) throw notFound;

  let matches = false;
  if (contact.includes('@')) {
    let email;
    try {
      email = cleanEmail(contact);
    } catch {
      throw notFound;
    }
    matches = Boolean(await User.exists({ _id: order.user, email }));
  } else {
    let mobile;
    try {
      mobile = cleanMobile(contact);
    } catch {
      throw notFound;
    }
    matches = order.address?.mobile === mobile || Boolean(await User.exists({ _id: order.user, mobile }));
  }
  if (!matches) throw notFound;

  const returns = await ReturnRequest.find({ order: order._id }).sort({ createdAt: -1 }).lean();
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: order.total,
    items: order.items.map((i) => ({ name: i.name, imageUrl: i.imageUrl, optionLabel: optionText(i.options), quantity: i.quantity })),
    statusHistory: order.statusHistory.map((h) => ({ status: h.status, at: h.at })),
    shipping: order.shipping?.trackingNumber ? { courier: order.shipping.courier, trackingNumber: order.shipping.trackingNumber, trackingUrl: order.shipping.trackingUrl } : undefined,
    cancellation: order.cancellation?.reason ? { reason: order.cancellation.reason, at: order.cancellation.at } : undefined,
    deliveryCity: order.address?.city,
    returns: returns.map((r) => customerReturn(r, order)),
  };
}


