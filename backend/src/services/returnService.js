import { storeImage } from '../integrations/media.js';
import { Order, Product, ReturnRequest, User } from '../models/index.js';
import { RETURN_REASONS } from '../models/ReturnRequest.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanText, escapeRegex, pageParams, requireObjectId, toBool } from '../utils/text.js';
import { cleanAddress } from './accountService.js';
import { refundOrder, restoreStock } from './fulfilmentService.js';
import { notifyReturnRequested, notifyReturnStatus, optionText } from './orderNotifications.js';
import { customerReturn, logOrderStock, releaseStock, reserveStock, returnWindowEnd } from './orderService.js';
import { getSettings } from './settingsService.js';

// Returns & exchanges (PRD §10.2–§10.5, §6.9). The server decides what can be
// returned, works out the refund, and moves each request forward only.

export const REASON_LABELS = {
  size_doesnt_fit: 'Size doesn’t fit',
  damaged: 'Damaged',
  wrong_item: 'Wrong item received',
  quality_not_expected: 'Quality not as expected',
  colour_different: 'Colour different from picture',
  other: 'Other',
};
// Our mistake: photos required, non-returnable items allowed, delivery refunded
const OUR_MISTAKE = ['damaged', 'wrong_item'];
const MAX_PHOTOS = 5;
const OPEN = ['requested', 'approved', 'pickup_scheduled', 'received'];

const variantPrice = (product, variant) => variant.price ?? product.sellingPrice;

async function loadOwnOrder(userId, orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30), user: userId });
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  return order;
}

async function checkWindow(order) {
  const settings = await getSettings();
  const end = returnWindowEnd(order, settings);
  if (!end) throw new HttpError(409, 'Returns and exchanges are possible once your order is delivered.');
  if (end < new Date()) throw new HttpError(409, `The ${settings.orders.returnWindowDays}-day return window for this order has ended.`);
  return { end, settings };
}

// Other sizes/colours of the same product a customer can swap to (PRD §10.4)
async function exchangeChoices(order) {
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) }, status: 'active' }, { variants: 1, sellingPrice: 1 }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const choices = {};
  for (const item of order.items) {
    const product = byId.get(String(item.product));
    choices[String(item._id)] = (product?.variants || [])
      .filter((v) => String(v._id) !== String(item.variantId))
      .map((v) => {
        const price = variantPrice(product, v);
        return {
          variantId: v._id,
          optionLabel: optionText(v.options),
          price,
          inStock: v.stock > 0,
          allowed: v.stock > 0 && price <= item.price,
          note: v.stock <= 0 ? 'Out of stock' : price > item.price ? 'Costs more: return this item and place a new order instead' : price < item.price ? `₹${(item.price - price).toLocaleString('en-IN')} back to you` : '',
        };
      });
  }
  return choices;
}

// ---------- Customer ----------
export async function getReturnOptions(userId, orderNumber) {
  const order = await loadOwnOrder(userId, orderNumber);
  const { end } = await checkWindow(order);
  const choices = await exchangeChoices(order);
  return {
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    windowEndsAt: end,
    reasons: Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label, photosRequired: OUR_MISTAKE.includes(value) })),
    pickupAddress: order.address,
    items: order.items.map((i) => ({
      orderItemId: i._id,
      name: i.name,
      imageUrl: i.imageUrl,
      optionLabel: optionText(i.options),
      price: i.price,
      quantity: i.quantity,
      available: i.quantity - (i.returnRequestedQty || 0),
      isReturnable: i.isReturnable !== false,
      exchangeOptions: choices[String(i._id)] || [],
    })),
  };
}

function cleanRefundDetails(body = {}) {
  const upiId = cleanText(body.upiId, 80);
  if (upiId) {
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) throw new HttpError(400, 'Please enter a valid UPI ID (for example name@okbank).');
    return { upiId };
  }
  const accountHolder = cleanText(body.accountHolder, 80);
  const accountNumber = cleanText(body.accountNumber, 30).replace(/\s/g, '');
  const ifsc = cleanText(body.ifsc, 20).toUpperCase();
  if (!accountHolder && !accountNumber && !ifsc) return null;
  if (!accountHolder) throw new HttpError(400, 'Please enter the account holder’s name.');
  if (!/^\d{9,18}$/.test(accountNumber)) throw new HttpError(400, 'Please enter a valid bank account number.');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpError(400, 'Please enter a valid IFSC code (for example SBIN0001234).');
  return { accountHolder, accountNumber, ifsc };
}

// Money due back for a request (PRD §6.9)
function refundDue(order, request) {
  const byId = new Map(order.items.map((i) => [String(i._id), i]));
  let amount = 0;
  for (const x of request.items) {
    const item = byId.get(String(x.orderItemId));
    if (!item) continue;
    if (request.type === 'return') amount += item.price * x.quantity;
    else if (x.exchangePrice != null && x.exchangePrice < item.price) amount += (item.price - x.exchangePrice) * x.quantity;
  }
  if (request.includesDeliveryCharge) amount += order.deliveryCharge || 0;
  return amount;
}

export async function createReturnRequest(userId, orderNumber, body = {}) {
  const order = await loadOwnOrder(userId, orderNumber);
  await checkWindow(order);

  const type = body.type;
  if (!['return', 'exchange'].includes(type)) throw new HttpError(400, 'Please choose Return or Exchange.');
  const reason = body.reason;
  if (!RETURN_REASONS.includes(reason)) throw new HttpError(400, 'Please choose a reason.');
  const comments = cleanText(body.comments, 1000);
  if (reason === 'other' && !comments) throw new HttpError(400, 'Please tell us a little about the problem.');

  const photos = (Array.isArray(body.photos) ? body.photos : []).map((p) => cleanText(p, 300)).filter((p) => p.startsWith('/uploads/') || /^https:\/\//.test(p));
  if (photos.length > MAX_PHOTOS) throw new HttpError(400, `Please add at most ${MAX_PHOTOS} photos.`);
  if (OUR_MISTAKE.includes(reason) && !photos.length) throw new HttpError(400, 'Please add at least one photo of the item so we can check the problem.');

  // Items and quantities
  const wanted = Array.isArray(body.items) ? body.items : [];
  const choices = type === 'exchange' ? await exchangeChoices(order) : {};
  const lines = [];
  for (const w of wanted) {
    const quantity = Math.floor(Number(w.quantity));
    if (!(quantity > 0)) continue;
    const item = order.items.id(String(w.orderItemId || ''));
    if (!item) throw new HttpError(400, 'Please choose the items again.');
    if (lines.some((l) => String(l.item._id) === String(item._id))) continue;
    if (item.isReturnable === false && !OUR_MISTAKE.includes(reason)) {
      throw new HttpError(400, `${item.name} can’t be returned or exchanged (hygiene), unless it arrived damaged or was the wrong item.`);
    }
    if (quantity > item.quantity - (item.returnRequestedQty || 0)) throw new HttpError(400, `You can return at most ${item.quantity - (item.returnRequestedQty || 0)} of ${item.name}.`);
    let exchange;
    if (type === 'exchange') {
      exchange = (choices[String(item._id)] || []).find((c) => String(c.variantId) === String(w.exchangeVariantId || ''));
      if (!exchange) throw new HttpError(400, `Please choose the new size or colour for ${item.name}.`);
      if (!exchange.inStock) throw new HttpError(409, `${item.name} (${exchange.optionLabel}) is out of stock. You can choose a return for a refund instead.`);
      if (!exchange.allowed) throw new HttpError(400, `${item.name} (${exchange.optionLabel}) costs more than you paid. Please return this item and place a new order instead.`);
    }
    lines.push({ item, quantity, exchange });
  }
  if (!lines.length) throw new HttpError(400, 'Please choose at least one item and quantity.');

  // COD: money can only come back by UPI/bank (PRD §9.4)
  const priceGap = lines.some((l) => l.exchange && l.exchange.price < l.item.price);
  const needsPayout = order.paymentMethod === 'cod' && (type === 'return' || priceGap);
  const refundDetails = cleanRefundDetails(body.refundDetails);
  if (needsPayout && !refundDetails) throw new HttpError(400, 'Please give a UPI ID or bank account so we can send your refund.');
  const pickupAddress = body.pickupAddress ? cleanAddress(body.pickupAddress) : order.address.toObject?.() || order.address;

  // Claim the quantities atomically, so the same item can't be returned twice
  const claimed = [];
  for (const line of lines) {
    const res = await Order.updateOne(
      { _id: order._id, items: { $elemMatch: { _id: line.item._id, returnRequestedQty: { $lte: line.item.quantity - line.quantity } } } },
      { $inc: { 'items.$.returnRequestedQty': line.quantity } },
    );
    if (!res.modifiedCount) {
      for (const c of claimed) await Order.updateOne({ _id: order._id, 'items._id': c.item._id }, { $inc: { 'items.$.returnRequestedQty': -c.quantity } });
      throw new HttpError(409, `A return for ${line.item.name} was already requested. Please reload the page.`);
    }
    claimed.push(line);
  }

  // Delivery charge comes back once per order when it was our mistake (PRD §6.9)
  let includesDeliveryCharge = false;
  if (OUR_MISTAKE.includes(reason) && type === 'return' && order.deliveryCharge > 0) {
    includesDeliveryCharge = (await Order.updateOne({ _id: order._id, deliveryRefundClaimed: { $ne: true } }, { deliveryRefundClaimed: true })).modifiedCount === 1;
  }

  const request = new ReturnRequest({
    order: order._id,
    user: userId,
    type,
    items: lines.map((l) => ({ orderItemId: l.item._id, quantity: l.quantity, exchangeVariantId: l.exchange?.variantId })),
    reason,
    comments,
    photos,
    refundDetails: refundDetails || undefined,
    pickupAddress,
    includesDeliveryCharge,
    statusHistory: [{ status: 'requested', by: 'customer', note: comments }],
  });
  const exchangePrices = lines.map((l) => ({ orderItemId: l.item._id, quantity: l.quantity, exchangePrice: l.exchange?.price }));
  request.refundAmount = refundDue(order, { type, items: exchangePrices, includesDeliveryCharge });
  try {
    await request.save();
  } catch (err) {
    for (const c of claimed) await Order.updateOne({ _id: order._id, 'items._id': c.item._id }, { $inc: { 'items.$.returnRequestedQty': -c.quantity } });
    if (includesDeliveryCharge) await Order.updateOne({ _id: order._id }, { deliveryRefundClaimed: false });
    throw err;
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    { status: 'return_requested', $push: { statusHistory: { status: 'return_requested', by: 'customer', note: `${type === 'exchange' ? 'Exchange' : 'Return'}: ${REASON_LABELS[reason]}` } } },
    { new: true },
  );
  notifyReturnRequested(updated, request, lines);
  return customerReturn(request.toObject(), updated);
}

// Customer photos for a return (damaged / wrong item)
export async function uploadReturnPhotos(files = []) {
  if (!files.length) throw new HttpError(400, 'Please choose a photo.');
  if (files.length > MAX_PHOTOS) throw new HttpError(400, `Please add at most ${MAX_PHOTOS} photos.`);
  const urls = [];
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) throw new HttpError(400, 'Each photo must be under 8 MB.');
    const stored = await storeImage(file.buffer);
    urls.push(stored.mediumUrl || stored.url);
  }
  return { urls };
}

// ---------- Admin (PRD §10.5, §14.7 Returns) ----------
export const RETURN_TABS = {
  requested: ['requested'],
  approved: ['approved'],
  pickup: ['pickup_scheduled'],
  received: ['received'],
  completed: ['refunded', 'replacement_shipped', 'closed'],
  rejected: ['rejected'],
};

export async function listReturnsForAdmin(query = {}) {
  const tab = RETURN_TABS[query.tab] ? query.tab : 'requested';
  const filter = { status: { $in: RETURN_TABS[tab] } };
  const q = cleanText(query.q, 60);
  if (q) {
    const orders = await Order.find({ $or: [{ orderNumber: new RegExp(escapeRegex(q), 'i') }, { 'address.fullName': new RegExp(escapeRegex(q), 'i') }, { 'address.mobile': new RegExp(escapeRegex(q), 'i') }] }, { _id: 1 }).limit(200).lean();
    filter.order = { $in: orders.map((o) => o._id) };
  }
  const { page, limit, skip } = pageParams(query, { defaultLimit: 25, maxLimit: 100 });
  const [rows, total, byStatus] = await Promise.all([
    ReturnRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber address items paymentMethod').lean(),
    ReturnRequest.countDocuments(filter),
    ReturnRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const count = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
  const counts = Object.fromEntries(Object.entries(RETURN_TABS).map(([k, list]) => [k, list.reduce((s, x) => s + (count[x] || 0), 0)]));
  return {
    items: rows.map((r) => ({
      id: r._id,
      orderNumber: r.order?.orderNumber,
      customer: r.order?.address?.fullName,
      type: r.type,
      itemsCount: r.items.reduce((s, x) => s + x.quantity, 0),
      reason: REASON_LABELS[r.reason] || r.reason,
      createdAt: r.createdAt,
      status: r.status,
      refundAmount: r.refundAmount || 0,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
  };
}

function adminActions(r, order) {
  const s = r.status;
  const owed = (r.refundAmount || 0) - (r.refundedAmount || 0);
  return {
    approve: s === 'requested',
    reject: s === 'requested',
    pickup: s === 'approved',
    receive: ['approved', 'pickup_scheduled'].includes(s),
    refund: owed > 0 && (r.type === 'return' ? s === 'received' : ['received', 'replacement_shipped'].includes(s)),
    // Wanted size gone: the customer can take a refund instead (PRD §10.4)
    refundInstead: r.type === 'exchange' && s === 'received',
    shipReplacement: r.type === 'exchange' && s === 'received',
    close: ['refunded', 'replacement_shipped'].includes(s),
    cod: order.paymentMethod === 'cod',
  };
}

export async function getReturnForAdmin(id) {
  const r = await ReturnRequest.findById(requireObjectId(id, 'We couldn’t find that request.')).lean();
  if (!r) throw new HttpError(404, 'We couldn’t find that request.');
  const order = await Order.findById(r.order).lean();
  const user = await User.findById(r.user, { name: 1, email: 1, mobile: 1 }).lean();
  const byId = new Map(order.items.map((i) => [String(i._id), i]));
  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } }, { variants: 1, sellingPrice: 1 }).lean();
  const variantOf = (productId, variantId) => {
    const p = products.find((x) => String(x._id) === String(productId));
    const v = p?.variants.find((x) => String(x._id) === String(variantId));
    return v ? { optionLabel: optionText(v.options), stock: v.stock, price: variantPrice(p, v) } : null;
  };
  return {
    id: r._id,
    type: r.type,
    status: r.status,
    reason: REASON_LABELS[r.reason] || r.reason,
    comments: r.comments,
    photos: r.photos,
    refundDetails: r.refundDetails,
    pickupAddress: r.pickupAddress,
    rejectionReason: r.rejectionReason,
    reversePickupTracking: r.reversePickupTracking,
    restock: r.restock,
    refundAmount: r.refundAmount || 0,
    refundedAmount: r.refundedAmount || 0,
    refundReference: r.refundReference,
    includesDeliveryCharge: r.includesDeliveryCharge,
    replacementTracking: r.replacementTracking,
    createdAt: r.createdAt,
    statusHistory: r.statusHistory,
    customer: user,
    order: { orderNumber: order.orderNumber, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, total: order.total, deliveredAt: order.shipping?.deliveredAt },
    items: r.items.map((x) => {
      const item = byId.get(String(x.orderItemId));
      return {
        name: item?.name, imageUrl: item?.imageUrl, optionLabel: optionText(item?.options), sku: item?.sku, price: item?.price, quantity: x.quantity,
        exchangeTo: x.exchangeVariantId ? variantOf(item?.product, x.exchangeVariantId) : null,
      };
    }),
    actions: adminActions(r, order),
  };
}

// Moves a request from one of `from` to `status` exactly once
async function step(id, from, status, update = {}, note) {
  const r = await ReturnRequest.findOneAndUpdate(
    { _id: requireObjectId(id, 'We couldn’t find that request.'), status: { $in: from } },
    { ...update, status, $push: { statusHistory: { status, by: 'admin', note } } },
    { new: true },
  );
  if (!r) {
    const current = await ReturnRequest.findById(id, { status: 1 }).lean();
    if (!current) throw new HttpError(404, 'We couldn’t find that request.');
    throw new HttpError(409, 'This request has already moved on. Please reload the page.');
  }
  return r;
}

async function setOrderStatus(orderId, status, note) {
  return Order.findOneAndUpdate({ _id: orderId }, { status, $push: { statusHistory: { status, by: 'admin', note } } }, { new: true });
}

// Gives the units back to the order so they could be requested again
async function releaseQuantities(r) {
  for (const x of r.items) {
    await Order.updateOne({ _id: r.order, 'items._id': x.orderItemId }, { $inc: { 'items.$.returnRequestedQty': -x.quantity } });
  }
  if (r.includesDeliveryCharge) await Order.updateOne({ _id: r.order }, { deliveryRefundClaimed: false });
}

export async function returnAction(id, action, body = {}) {
  const note = cleanText(body.note, 300);
  let r;
  let order;
  switch (action) {
    case 'approve':
      r = await step(id, ['requested'], 'approved', {}, note);
      order = await setOrderStatus(r.order, 'return_approved', `${r.type === 'exchange' ? 'Exchange' : 'Return'} approved`);
      break;
    case 'reject': {
      const reason = cleanText(body.reason, 300);
      if (!reason) throw new HttpError(400, 'Please give a reason. The customer will see it.');
      r = await step(id, ['requested'], 'rejected', { rejectionReason: reason }, reason);
      await releaseQuantities(r);
      order = await setOrderStatus(r.order, 'return_rejected', reason);
      break;
    }
    case 'pickup':
      r = await step(id, ['approved'], 'pickup_scheduled', { reversePickupTracking: cleanText(body.tracking, 80) || undefined }, note);
      order = await Order.findById(r.order);
      break;
    case 'receive': {
      const restock = toBool(body.restock);
      r = await step(id, ['approved', 'pickup_scheduled'], 'received', { restock }, restock ? 'Received; back in stock' : 'Received; not resellable');
      order = await setOrderStatus(r.order, 'returned', 'Returned item(s) received');
      if (restock) {
        const byId = new Map(order.items.map((i) => [String(i._id), i]));
        const items = r.items.map((x) => ({ ...byId.get(String(x.orderItemId)).toObject(), quantity: x.quantity }));
        await restoreStock(order, items, { reason: r.type === 'exchange' ? 'exchange' : 'return', note: `${order.orderNumber} ${r.type}` });
      }
      break;
    }
    case 'refund':
    case 'refund-instead': {
      const current = await ReturnRequest.findById(requireObjectId(id)).lean();
      if (!current) throw new HttpError(404, 'We couldn’t find that request.');
      order = await Order.findById(current.order);
      const instead = action === 'refund-instead';
      if (instead) {
        if (current.type !== 'exchange' || current.status !== 'received') throw new HttpError(409, 'A refund instead of an exchange is possible once the item is received.');
      } else {
        const ok = current.type === 'return' ? current.status === 'received' : ['received', 'replacement_shipped'].includes(current.status);
        if (!ok) throw new HttpError(409, 'Refund once the returned item is received.');
      }
      // For "refund instead", the full price of the exchanged items is due
      const due = instead ? refundDue(order, { type: 'return', items: current.items, includesDeliveryCharge: current.includesDeliveryCharge }) : current.refundAmount || 0;
      const owed = due - (current.refundedAmount || 0);
      const amount = body.amount != null && body.amount !== '' ? Math.round(Number(body.amount)) : owed;
      if (!(amount > 0)) throw new HttpError(400, 'There is nothing left to refund on this request.');
      if (amount > owed) throw new HttpError(400, `The most you can refund for this request is ₹${owed.toLocaleString('en-IN')}.`);
      // Mark it first so a double click can't refund twice; undo if the refund fails
      const claimed = await ReturnRequest.findOneAndUpdate(
        { _id: current._id, status: current.status, refundedAmount: current.refundedAmount || 0 },
        { $inc: { refundedAmount: amount } },
        { new: true },
      );
      if (!claimed) throw new HttpError(409, 'This request changed in the meantime. Please reload the page.');
      let result;
      try {
        result = await refundOrder(order, { amount, reason: `${instead ? 'Refund instead of exchange' : current.type === 'exchange' ? 'Exchange price difference' : 'Return'} (${order.orderNumber})`, manualReference: cleanText(body.manualReference, 80) });
      } catch (err) {
        await ReturnRequest.updateOne({ _id: current._id }, { $inc: { refundedAmount: -amount } });
        throw err;
      }
      const finishes = current.status === 'received';
      r = await ReturnRequest.findOneAndUpdate(
        { _id: current._id },
        {
          ...(instead && { refundAmount: due }),
          ...(finishes && { status: 'refunded' }),
          refundReference: result.reference,
          refundedAt: new Date(),
          $push: { statusHistory: { status: finishes ? 'refunded' : current.status, by: 'admin', note: `Refund ₹${amount.toLocaleString('en-IN')}` } },
        },
        { new: true },
      );
      if (finishes) order = await setOrderStatus(r.order, 'refunded', `Refunded ₹${amount.toLocaleString('en-IN')}`);
      return getReturnForAdmin(r._id);
    }
    case 'ship-replacement': {
      const current = await ReturnRequest.findById(requireObjectId(id)).lean();
      if (!current || current.type !== 'exchange' || current.status !== 'received') throw new HttpError(409, 'Ship the replacement once the returned item is received.');
      const courier = cleanText(body.courier, 60);
      const trackingNumber = cleanText(body.trackingNumber, 60);
      const trackingUrl = cleanText(body.trackingUrl, 300);
      if (!courier || !trackingNumber) throw new HttpError(400, 'Please enter the courier name and tracking number.');
      if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) throw new HttpError(400, 'The tracking link must start with http:// or https://');
      order = await Order.findById(current.order);
      const byId = new Map(order.items.map((i) => [String(i._id), i]));
      const products = await Product.find({ _id: { $in: current.items.map((x) => byId.get(String(x.orderItemId))?.product) } }, { name: 1, variants: 1 }).lean();
      const replacements = current.items.map((x) => {
        const item = byId.get(String(x.orderItemId));
        const product = products.find((p) => String(p._id) === String(item.product));
        const v = product?.variants.find((y) => String(y._id) === String(x.exchangeVariantId));
        if (!v) throw new HttpError(409, `The chosen option for ${item.name} no longer exists. Please refund instead.`);
        return { product: item.product, variantId: v._id, sku: v.sku, name: item.name, options: v.options, quantity: x.quantity };
      });
      // Take the new size/colour out of stock (fails cleanly if it sold out)
      let taken;
      try {
        taken = await reserveStock(replacements);
      } catch (err) {
        if (err.soldOut) throw new HttpError(409, `${err.message.replace('Please review your cart.', '')} Please refund the customer instead.`);
        throw err;
      }
      r = await ReturnRequest.findOneAndUpdate(
        { _id: current._id, status: 'received' },
        { status: 'replacement_shipped', replacementTracking: { courier, trackingNumber, trackingUrl }, $push: { statusHistory: { status: 'replacement_shipped', by: 'admin', note: `${courier} ${trackingNumber}` } } },
        { new: true },
      );
      if (!r) {
        await releaseStock(taken);
        throw new HttpError(409, 'This request changed in the meantime. Please reload the page.');
      }
      await logOrderStock(order, taken, 'exchange', `${order.orderNumber} replacement`);
      order = await setOrderStatus(r.order, 'exchanged', `Replacement shipped: ${courier} ${trackingNumber}`);
      break;
    }
    case 'close':
      r = await step(id, ['refunded', 'replacement_shipped'], 'closed', {}, note);
      order = await Order.findById(r.order);
      break;
    default:
      throw new HttpError(400, 'That action isn’t possible.');
  }
  notifyReturnStatus(order, r);
  return getReturnForAdmin(r._id);
}

