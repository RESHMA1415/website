import { env } from '../config/env.js';
import { sendEmail } from '../integrations/email.js';
import {
  capturePayment,
  createRazorpayOrder,
  fetchPayment,
  paymentMethodName,
  publicKeyId,
  razorpayConfigured,
  refundPayment,
  toPaise,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../integrations/razorpay.js';
import { Cart, Counter, Order, Payment, Product, ReturnRequest, StockMovement, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanText, pageParams } from '../utils/text.js';
import { addAddress, cleanAddress, listAddresses } from './accountService.js';
import { buildCartView } from './cartService.js';
import { calculateTotals, isCodAllowed } from './pricingService.js';
import { getSettings } from './settingsService.js';

// Checkout, orders and payments (PRD §6, §8, §9, Phase 4).
// Every amount is worked out here; nothing from the browser is trusted.
export const PENDING_PAYMENT_MINUTES = 30;
const formatINR = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const optionText = (o = {}) => [o.colour, o.size, o.shade, o.volume].filter(Boolean).join(' / ');

// ---------- Order numbers: SHM-YYMMDD-XXXX (India date, running number per day) ----------
function indiaDateKey(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(ist.getUTCFullYear()).slice(-2)}${pad(ist.getUTCMonth() + 1)}${pad(ist.getUTCDate())}`;
}

export async function nextOrderNumber(date = new Date()) {
  const key = indiaDateKey(date);
  const counter = await Counter.findOneAndUpdate({ _id: `order-${key}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `SHM-${key}-${String(counter.seq).padStart(4, '0')}`;
}

// ---------- Checkout page ----------
async function cartFor(userId) {
  return buildCartView(await Cart.findOne({ user: userId }).lean());
}

export async function getCheckout(userId) {
  const [cart, settings, addresses] = await Promise.all([cartFor(userId), getSettings(), listAddresses(userId)]);
  const buyable = cart.items.filter((i) => i.status === 'ok');
  const online = calculateTotals(buyable, settings, 'online');
  const cod = calculateTotals(buyable, settings, 'cod');
  return {
    cart,
    addresses,
    totals: { online, cod },
    payment: {
      onlineAvailable: razorpayConfigured(),
      codEnabled: settings.cod.enabled,
      codAllowed: isCodAllowed(cod.total, settings),
      codCharge: settings.cod.charge,
      codMaxOrderValue: settings.cod.maxOrderValue,
    },
    delivery: { minDays: settings.delivery.estimateMinDays, maxDays: settings.delivery.estimateMaxDays },
  };
}

async function resolveAddress(userId, body) {
  if (body.addressId) {
    const user = await User.findById(userId, { addresses: 1 });
    const saved = user?.addresses.id(String(body.addressId));
    if (!saved) throw new HttpError(400, 'Please choose a delivery address.');
    const { _id, isDefault, ...address } = saved.toObject();
    return address;
  }
  if (!body.address) throw new HttpError(400, 'Please choose or add a delivery address.');
  const address = cleanAddress(body.address);
  if (body.saveAddress === true) {
    // Saving is a convenience: a full address book never blocks the order
    await addAddress(userId, { ...address, isDefault: false }).catch(() => {});
  }
  return address;
}

// ---------- Stock (PRD §6.5): reduced only when an order is paid or COD placed ----------
// Each decrement only succeeds while enough stock is left, so the last item
// can never be sold twice. On a shortfall, everything taken so far is put back.
export async function reserveStock(items) {
  const taken = [];
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } } },
      { $inc: { 'variants.$.stock': -item.quantity, unitsSold: item.quantity } },
      { new: true, projection: { variants: { $elemMatch: { _id: item.variantId } } } },
    ).lean();
    if (!updated) {
      await releaseStock(taken);
      const error = new HttpError(409, `Sorry, ${item.name}${optionText(item.options) ? ` (${optionText(item.options)})` : ''} just sold out. Please review your cart.`);
      error.soldOut = true;
      throw error;
    }
    taken.push({ item, stockAfter: updated.variants[0].stock });
  }
  return taken;
}

export async function releaseStock(taken) {
  for (const { item } of taken) {
    await Product.updateOne(
      { _id: item.product, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity, unitsSold: -item.quantity } },
    );
  }
}

export async function logOrderStock(order, taken, reason = 'order', note = order.orderNumber) {
  if (!taken.length) return;
  await StockMovement.insertMany(
    taken.map(({ item, stockAfter }) => ({
      product: item.product, variantId: item.variantId, sku: item.sku, change: -item.quantity, stockAfter, reason, order: order._id, note,
    })),
  );
}

// The bought items leave the cart (anything else the customer added stays)
async function removeOrderedFromCart(userId, items) {
  await Cart.updateOne(
    { user: userId },
    { $pull: { items: { $or: items.map((i) => ({ product: i.product, variantId: i.variantId })) } } },
  );
}

// ---------- Notifications (full set in Phase 7). Never block an order. ----------
async function orderConfirmedMessages(order) {
  try {
    const [user, settings] = await Promise.all([User.findById(order.user, { name: 1, email: 1 }).lean(), getSettings()]);
    const lines = order.items.map((i) => `- ${i.name}${optionText(i.options) ? ` (${optionText(i.options)})` : ''} × ${i.quantity}: ${formatINR(i.price * i.quantity)}`).join('\n');
    const money = `Subtotal: ${formatINR(order.subtotal)}\nDelivery: ${order.deliveryCharge ? formatINR(order.deliveryCharge) : 'FREE'}${order.codCharge ? `\nCash on Delivery charge: ${formatINR(order.codCharge)}` : ''}\nTotal: ${formatINR(order.total)}`;
    const paid = order.paymentMethod === 'cod' ? `Please keep ${formatINR(order.total)} ready to pay on delivery.` : 'Paid online.';
    if (user?.email) {
      await sendEmail({
        event: 'order_confirmed',
        to: user.email,
        order: order._id,
        action: { label: 'View your order', url: `${env.storeUrl}/account/orders/${order.orderNumber}` },
        subject: `Order confirmed: ${order.orderNumber}`,
        text: `Hi ${user.name},\n\nThank you for shopping with ${settings.store.name}! Your order ${order.orderNumber} is confirmed.\n\n${lines}\n\n${money}\n${paid}\n\nExpected delivery: ${settings.delivery.estimateMinDays}–${settings.delivery.estimateMaxDays} business days.\nTrack your order: ${env.storeUrl}/account/orders/${order.orderNumber}`,
      });
    }
    if (settings.notifications.adminAlertEmail) {
      await sendEmail({
        event: 'order_confirmed_admin',
        to: settings.notifications.adminAlertEmail,
        order: order._id,
        action: { label: 'Open in admin panel', url: `${env.adminUrl}/orders/${order.orderNumber}` },
        subject: `New order ${order.orderNumber} (${order.paymentMethod === 'cod' ? 'COD' : 'Paid online'}) ${formatINR(order.total)}`,
        text: `New order ${order.orderNumber} from ${order.address.fullName} (${order.address.mobile}), ${order.address.city}.\n\n${lines}\n\n${money}`,
      });
    }
  } catch (err) {
    console.error('Order notification failed', err);
  }
}

// ---------- Placing an order ----------
export async function placeOrder(userId, body) {
  if (body.agreeTerms !== true) throw new HttpError(400, 'Please agree to the Terms & Conditions and Return Policy to place your order.');
  const method = body.paymentMethod;
  if (!['online', 'cod'].includes(method)) throw new HttpError(400, 'Please choose how you’d like to pay.');

  // Stock and prices are re-checked now, before any payment (PRD §6.5)
  const [cart, settings] = await Promise.all([cartFor(userId), getSettings()]);
  if (!cart.items.length) throw new HttpError(400, 'Your cart is empty.');
  if (!cart.canCheckout) throw new HttpError(409, 'Some items in your cart have changed (stock or availability). Please review your cart before paying.');

  const totals = calculateTotals(cart.items, settings, method);
  if (method === 'cod') {
    if (!settings.cod.enabled) throw new HttpError(400, 'Cash on Delivery is not available right now. Please pay online.');
    if (!isCodAllowed(totals.total, settings)) {
      throw new HttpError(400, `Cash on Delivery is available on orders up to ${formatINR(settings.cod.maxOrderValue)}. Please pay online.`);
    }
  } else if (!razorpayConfigured()) {
    throw new HttpError(503, 'Online payment isn’t available yet. Please choose Cash on Delivery.');
  }

  const address = await resolveAddress(userId, body);
  const items = cart.items.map((l) => ({
    product: l.productId,
    variantId: l.variantId,
    name: l.name,
    imageUrl: l.imageUrl,
    options: { size: l.options?.size, colour: l.options?.colour, shade: l.options?.shade, volume: l.options?.volume },
    sku: l.sku,
    mrp: l.mrp,
    price: l.price,
    quantity: l.quantity,
    isReturnable: l.isReturnable,
  }));
  const base = {
    user: userId,
    items,
    address,
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    codCharge: totals.codCharge,
    total: totals.total,
    savings: totals.savings,
    paymentMethod: method,
  };

  if (method === 'cod') {
    const taken = await reserveStock(items);
    let order;
    try {
      order = await Order.create({
        ...base,
        orderNumber: await nextOrderNumber(),
        status: 'confirmed',
        paymentStatus: 'cod_pending',
        statusHistory: [{ status: 'confirmed', by: 'system', note: 'Cash on Delivery order placed' }],
      });
    } catch (err) {
      await releaseStock(taken);
      throw err;
    }
    await Promise.all([
      logOrderStock(order, taken),
      Payment.create({ order: order._id, user: userId, provider: 'cod', amount: order.total, method: 'cod', status: 'cod_pending' }),
      removeOrderedFromCart(userId, items),
    ]);
    orderConfirmedMessages(order);
    return { orderNumber: order.orderNumber, status: order.status, paymentMethod: 'cod' };
  }

  const order = await Order.create({
    ...base,
    orderNumber: await nextOrderNumber(),
    status: 'pending_payment',
    paymentStatus: 'pending',
    statusHistory: [{ status: 'pending_payment', by: 'system', note: 'Waiting for online payment' }],
  });
  return startPaymentAttempt(order);
}

// Creates a Razorpay order for the server-computed total and hands the
// payment window what it needs. Each try (including retries) is a Payment.
async function startPaymentAttempt(order) {
  const [user, settings] = await Promise.all([User.findById(order.user, { name: 1, email: 1, mobile: 1 }).lean(), getSettings()]);
  let rp;
  try {
    rp = await createRazorpayOrder({ amount: order.total, receipt: order.orderNumber, notes: { orderNumber: order.orderNumber } });
  } catch (err) {
    console.error('Razorpay order failed', err);
    throw new HttpError(502, 'We couldn’t start the payment. Please try again in a moment.');
  }
  await Payment.create({ order: order._id, user: order.user, provider: 'razorpay', razorpayOrderId: rp.id, amount: order.total, status: 'pending' });
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: 'online',
    razorpay: {
      key: publicKeyId(),
      orderId: rp.id,
      amount: toPaise(order.total),
      currency: 'INR',
      name: settings.store.name,
      description: `Order ${order.orderNumber}`,
      prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
      notes: { orderNumber: order.orderNumber },
    },
  };
}

// ---------- After the customer pays ----------
async function refundWholePayment(payment, reason) {
  try {
    const refund = await refundPayment(payment.razorpayPaymentId, payment.amount, { reason });
    await Payment.updateOne(
      { _id: payment._id },
      { status: 'refunded', $inc: { refundedAmount: payment.amount }, $push: { refunds: { amount: payment.amount, razorpayRefundId: refund.id, reason, by: 'system' } } },
    );
    return 'refunded';
  } catch (err) {
    // The admin sees this in Payments and can refund by hand (Phase 5/8)
    console.error(`Automatic refund failed for payment ${payment.razorpayPaymentId}`, err);
    await Payment.updateOne({ _id: payment._id }, { status: 'refund_initiated', failureReason: `Automatic refund failed: ${err.message}` });
    return 'refund_initiated';
  }
}

function outcome(order, extra = {}) {
  return { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, ...extra };
}

// Confirms a paid order exactly once, whether the browser or the webhook gets here first
async function finalizePayment(payment, razorpayPaymentId) {
  let rp = await fetchPayment(razorpayPaymentId);
  if (rp.order_id !== payment.razorpayOrderId) throw new HttpError(400, 'This payment does not belong to this order.');
  if (rp.amount !== toPaise(payment.amount)) throw new HttpError(400, 'The amount paid does not match the order. Please contact us.');
  if (rp.status === 'authorized') rp = await capturePayment(razorpayPaymentId, payment.amount);
  if (rp.status !== 'captured') throw new HttpError(402, 'The payment was not completed. No money was taken.');

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'failed'] } },
    { status: 'paid', razorpayPaymentId, method: paymentMethodName(rp.method), $unset: { failureReason: 1 } },
    { new: true },
  );
  const order = await Order.findById(payment.order);
  if (!claimed) return outcome(order); // already handled

  // Paid twice, or paid after the order expired: give this money back
  if (order.status !== 'pending_payment') {
    const refund = await refundWholePayment(claimed, order.status === 'cancelled' ? 'Order had expired before payment' : 'Duplicate payment for the same order');
    return outcome(order, { duplicatePayment: true, refund });
  }

  let taken;
  try {
    taken = await reserveStock(order.items);
  } catch (err) {
    if (!err.soldOut) throw err;
    // Lost the race for the last item: cancel and refund automatically (PRD §6.5)
    const refund = await refundWholePayment(claimed, 'Item sold out while paying');
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending_payment' },
      {
        status: 'cancelled',
        paymentStatus: refund === 'refunded' ? 'refunded' : 'refund_initiated',
        refundedAmount: refund === 'refunded' ? claimed.amount : 0,
        cancellation: { reason: 'An item sold out while you were paying. Your payment has been refunded.', by: 'system', at: new Date() },
        $push: { statusHistory: { status: 'cancelled', by: 'system', note: 'Sold out during payment; automatic refund' } },
      },
      { new: true },
    );
    return outcome(cancelled || order, { soldOut: true, refund, message: err.message });
  }

  const confirmed = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending_payment' },
    { status: 'confirmed', paymentStatus: 'paid', $push: { statusHistory: { status: 'confirmed', by: 'system', note: 'Paid online' } } },
    { new: true },
  );
  if (!confirmed) {
    // Expired in the same instant: undo and refund
    await releaseStock(taken);
    const refund = await refundWholePayment(claimed, 'Order had expired before payment');
    return outcome(await Order.findById(order._id), { refund });
  }
  await Promise.all([logOrderStock(confirmed, taken), removeOrderedFromCart(confirmed.user, confirmed.items)]);
  orderConfirmedMessages(confirmed);
  return outcome(confirmed);
}

// Called by the website right after the Razorpay window reports success
export async function verifyCheckoutPayment(userId, body) {
  const razorpayOrderId = cleanText(body.razorpayOrderId, 60);
  const razorpayPaymentId = cleanText(body.razorpayPaymentId, 60);
  const payment = await Payment.findOne({ razorpayOrderId, user: userId, provider: 'razorpay' });
  if (!payment) throw new HttpError(404, 'We couldn’t find this payment. Please contact us if money was taken.');
  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature: body.signature })) {
    throw new HttpError(400, 'We couldn’t confirm this payment. If money was taken, it will be refunded automatically.');
  }
  return finalizePayment(payment, razorpayPaymentId);
}

// The Razorpay window was closed or the payment failed. The order waits for a retry.
// "Payment failed – retry" email (PRD §12.2), once per order, while it can still be paid
async function paymentFailedMessage(orderId) {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'pending_payment', paymentFailedEmailSent: { $ne: true } },
      { paymentFailedEmailSent: true },
      { new: true },
    ).lean();
    if (!order || isExpired(order)) return;
    const [user, settings] = await Promise.all([User.findById(order.user, { name: 1, email: 1 }).lean(), getSettings()]);
    if (!user?.email) return;
    const minutesLeft = Math.max(1, PENDING_PAYMENT_MINUTES - Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
    await sendEmail({
      event: 'payment_failed',
      to: user.email,
      order: order._id,
      subject: `Payment not completed for order ${order.orderNumber}`,
      text: `Hi ${user.name},\n\nYour payment of ${formatINR(order.total)} for order ${order.orderNumber} didn't go through. No money was taken. If money was deducted, your bank or Razorpay returns it automatically within 5–7 business days.\n\nYour order is kept for about ${minutesLeft} more minutes. You can try paying again here: ${env.storeUrl}/account/orders/${order.orderNumber}\n\nNeed help? Call or WhatsApp us on ${settings.store.phone}.`,
      action: { label: 'Complete your payment', url: `${env.storeUrl}/account/orders/${order.orderNumber}` },
    });
  } catch (err) {
    console.error('Payment failed email', err);
  }
}

export async function recordPaymentFailure(userId, body) {
  const razorpayOrderId = cleanText(body.razorpayOrderId, 60);
  await Payment.updateOne(
    { razorpayOrderId, user: userId, status: 'pending' },
    { status: 'failed', failureReason: cleanText(body.reason, 200) || 'Payment not completed' },
  );
  const payment = await Payment.findOne({ razorpayOrderId, user: userId }).lean();
  if (!payment) throw new HttpError(404, 'We couldn’t find this payment.');
  const order = await Order.findById(payment.order).lean();
  paymentFailedMessage(order._id);
  return outcome(order);
}

function isExpired(order) {
  return Date.now() - new Date(order.createdAt).getTime() > PENDING_PAYMENT_MINUTES * 60000;
}

export async function retryPayment(userId, orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30), user: userId });
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  if (order.status !== 'pending_payment') throw new HttpError(409, order.status === 'confirmed' ? 'This order is already paid.' : 'This order can no longer be paid. Please order again from your cart.');
  if (isExpired(order)) throw new HttpError(410, `This payment session expired after ${PENDING_PAYMENT_MINUTES} minutes. Please place the order again from your cart.`);
  if (!razorpayConfigured()) throw new HttpError(503, 'Online payment isn’t available right now.');
  // Check (not reserve) stock before asking for money again
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } }, { variants: 1 }).lean();
  for (const item of order.items) {
    const variant = products.find((p) => String(p._id) === String(item.product))?.variants.find((v) => String(v._id) === String(item.variantId));
    if (!variant || variant.stock < item.quantity) throw new HttpError(409, `Sorry, ${item.name} just sold out. Please review your cart.`);
  }
  return startPaymentAttempt(order);
}

// ---------- Razorpay webhook (backup confirmation, PRD §9.2 step 4) ----------
export async function handleRazorpayWebhook(rawBody, signature, eventId) {
  if (!verifyWebhookSignature(rawBody, signature)) throw new HttpError(400, 'Invalid signature');
  const event = JSON.parse(rawBody.toString('utf8'));
  const entity = event?.payload?.payment?.entity;
  if (!entity?.order_id) return { ignored: true };
  const payment = await Payment.findOne({ razorpayOrderId: entity.order_id, provider: 'razorpay' });
  if (!payment) return { ignored: true };

  // Razorpay may send an event more than once: handle each one only once
  const key = eventId || `${event.event}:${entity.id}`;
  const fresh = await Payment.updateOne({ _id: payment._id, processedEventIds: { $ne: key } }, { $push: { processedEventIds: key } });
  if (!fresh.modifiedCount) return { duplicate: true };

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid' || (event.event === 'payment.authorized')) {
      return await finalizePayment(payment, entity.id);
    }
    if (event.event === 'payment.failed') {
      await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed', failureReason: cleanText(entity.error_description, 200) || 'Payment failed' });
      paymentFailedMessage(payment.order);
      return { failed: true };
    }
    return { ignored: true };
  } catch (err) {
    // Let Razorpay retry this event later
    await Payment.updateOne({ _id: payment._id }, { $pull: { processedEventIds: key } });
    throw err;
  }
}

// ---------- Unpaid orders disappear after 30 minutes (PRD §8.1) ----------
export async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_MINUTES * 60000);
  const stale = await Order.find({ status: 'pending_payment', createdAt: { $lt: cutoff } }, { _id: 1 }).lean();
  let expired = 0;
  for (const { _id } of stale) {
    if (await Payment.exists({ order: _id, status: 'paid' })) continue; // being confirmed right now
    const result = await Order.updateOne(
      { _id, status: 'pending_payment' },
      {
        status: 'cancelled',
        paymentStatus: 'failed',
        cancellation: { reason: 'Payment was not completed', by: 'system', at: new Date() },
        $push: { statusHistory: { status: 'cancelled', by: 'system', note: `Not paid within ${PENDING_PAYMENT_MINUTES} minutes` } },
      },
    );
    expired += result.modifiedCount;
  }
  return expired;
}

// ---------- My Orders ----------
// Orders that were never paid/placed are not shown to the customer (PRD §8.1)
export const PLACED = { 'statusHistory.status': 'confirmed' };
export const CANCELLABLE_STATUSES = ['confirmed', 'processing'];
// Statuses an order can be in after delivery (returns may follow)
export const AFTER_DELIVERY = ['delivered', 'return_requested', 'return_approved', 'return_rejected', 'returned', 'refunded', 'exchanged'];

// Last day a return/exchange can be requested (PRD §10.2), or null
export function returnWindowEnd(order, settings) {
  if (!order.shipping?.deliveredAt || !AFTER_DELIVERY.includes(order.status)) return null;
  return new Date(new Date(order.shipping.deliveredAt).getTime() + settings.orders.returnWindowDays * 86400000);
}

const RETURN_STEP = {
  requested: 'Requested', approved: 'Approved', rejected: 'Rejected', pickup_scheduled: 'Pickup scheduled',
  received: 'Received by us', refunded: 'Refunded', replacement_shipped: 'Replacement shipped', closed: 'Closed',
};

export function customerReturn(r, order) {
  const byId = new Map(order.items.map((i) => [String(i._id), i]));
  return {
    id: r._id,
    type: r.type,
    reason: r.reason,
    status: r.status,
    statusLabel: RETURN_STEP[r.status] || r.status,
    createdAt: r.createdAt,
    rejectionReason: r.rejectionReason,
    reversePickupTracking: r.reversePickupTracking,
    replacementTracking: r.replacementTracking?.trackingNumber ? r.replacementTracking : undefined,
    refundedAmount: r.refundedAmount || 0,
    items: r.items.map((x) => {
      const item = byId.get(String(x.orderItemId));
      return { name: item?.name, optionLabel: optionText(item?.options), quantity: x.quantity };
    }),
    history: r.statusHistory.map((h) => ({ status: h.status, label: RETURN_STEP[h.status] || h.status, at: h.at, note: h.by === 'admin' && h.status !== 'rejected' ? undefined : h.note })),
  };
}

function customerOrder(order, payment, extra = {}) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: order.items.map((i) => ({ name: i.name, imageUrl: i.imageUrl, options: i.options, optionLabel: optionText(i.options), sku: i.sku, mrp: i.mrp, price: i.price, quantity: i.quantity, product: i.product, reviewed: Boolean(i.reviewed) })),
    // Verified-buyer reviews open once the order was delivered (PRD §11.1)
    canReview: order.statusHistory.some((h) => h.status === 'delivered'),
    address: order.address,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    codCharge: order.codCharge,
    total: order.total,
    savings: order.savings,
    statusHistory: order.statusHistory.map((h) => ({ status: h.status, at: h.at, note: h.by === 'admin' ? undefined : h.note })),
    shipping: order.shipping,
    cancellation: order.cancellation?.reason ? { reason: order.cancellation.reason, at: order.cancellation.at } : undefined,
    refundedAmount: order.refundedAmount,
    payment: payment ? { method: payment.method, status: payment.status } : undefined,
    canRetryPayment: order.status === 'pending_payment' && !isExpired(order),
    canCancel: CANCELLABLE_STATUSES.includes(order.status),
    ...extra,
  };
}

export async function listMyOrders(userId, query) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 10, maxLimit: 50 });
  const filter = { user: userId, ...PLACED };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items: orders.map((o) => customerOrder(o)), total, page, pages: Math.ceil(total / limit) };
}

export async function getMyOrder(userId, orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30), user: userId }).lean();
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  const [payment, returns, settings] = await Promise.all([
    Payment.findOne({ order: order._id }).sort({ createdAt: -1 }).lean(),
    ReturnRequest.find({ order: order._id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);
  const windowEnd = returnWindowEnd(order, settings);
  const openQty = order.items.some((i) => i.quantity > (i.returnRequestedQty || 0));
  return customerOrder(order, payment, {
    returnWindowEndsAt: windowEnd,
    canReturn: Boolean(windowEnd && windowEnd > new Date() && openQty),
    returns: returns.map((r) => customerReturn(r, order)),
  });
}
