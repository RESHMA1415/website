import { Order, ReturnRequest, Review, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { toCsv } from '../utils/csv.js';
import { cleanText, escapeRegex, pageParams, requireObjectId } from '../utils/text.js';
import { optionText } from './orderNotifications.js';

// Customer Management (PRD §14.6): list, detail, block/unblock, export.
// "Spent" uses the sales rule: placed orders, not cancelled, minus refunds.

const placed = { 'statusHistory.status': 'confirmed' };

function userFilter(query) {
  const filter = {};
  if (query.status === 'blocked') filter.isBlocked = true;
  if (query.status === 'active') filter.isBlocked = { $ne: true };
  const q = cleanText(query.q, 80);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { mobile: pattern }];
  }
  return filter;
}

// Orders, spend and last order date for a set of customers
async function orderStats(userIds) {
  const rows = await Order.aggregate([
    { $match: { user: { $in: userIds }, ...placed } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        spent: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] }] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { name: 1 } };

export async function listCustomersForAdmin(query = {}) {
  const filter = userFilter(query);
  const { page, limit, skip } = pageParams(query, { defaultLimit: 25, maxLimit: 100 });
  const [users, total, blocked] = await Promise.all([
    User.find(filter, { name: 1, email: 1, mobile: 1, createdAt: 1, isBlocked: 1, lastLoginAt: 1 }).sort(SORTS[query.sort] || SORTS.newest).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
    User.countDocuments({ isBlocked: true }),
  ]);
  const stats = await orderStats(users.map((u) => u._id));
  return {
    items: users.map((u) => {
      const s = stats.get(String(u._id));
      return { ...u, orders: s?.orders || 0, spent: Math.round(s?.spent || 0), lastOrderAt: s?.lastOrderAt || null };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
    blocked,
  };
}

export async function getCustomerForAdmin(id) {
  const user = await User.findById(requireObjectId(id, 'We couldn’t find that customer.'), { passwordHash: 0 }).lean();
  if (!user) throw new HttpError(404, 'We couldn’t find that customer.');
  const [orders, reviews, returns, stats] = await Promise.all([
    Order.find({ user: user._id, ...placed }, { orderNumber: 1, createdAt: 1, total: 1, status: 1, paymentMethod: 1, refundedAmount: 1, items: 1 }).sort({ createdAt: -1 }).limit(100).lean(),
    Review.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).populate('product', 'name slug').lean(),
    ReturnRequest.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).populate('order', 'orderNumber').lean(),
    orderStats([user._id]),
  ]);
  const s = stats.get(String(user._id));
  return {
    profile: {
      _id: user._id, name: user.name, email: user.email, mobile: user.mobile, gender: user.gender, dateOfBirth: user.dateOfBirth,
      createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, isBlocked: Boolean(user.isBlocked), blockedReason: user.blockedReason, blockedAt: user.blockedAt,
      mobileVerifiedAt: user.mobileVerifiedAt, consent: user.consent,
    },
    addresses: user.addresses || [],
    stats: { orders: s?.orders || 0, spent: Math.round(s?.spent || 0), lastOrderAt: s?.lastOrderAt || null },
    orders: orders.map((o) => ({ orderNumber: o.orderNumber, createdAt: o.createdAt, total: o.total, refundedAmount: o.refundedAmount || 0, status: o.status, paymentMethod: o.paymentMethod, items: o.items.map((i) => `${i.name}${optionText(i.options) ? ` (${optionText(i.options)})` : ''} × ${i.quantity}`) })),
    reviews: reviews.map((r) => ({ id: r._id, product: r.product?.name || 'Deleted product', slug: r.product?.slug, rating: r.rating, title: r.title, status: r.status, createdAt: r.createdAt })),
    returns: returns.map((r) => ({ id: r._id, orderNumber: r.order?.orderNumber, type: r.type, reason: r.reason, status: r.status, refundedAmount: r.refundedAmount || 0, createdAt: r.createdAt })),
  };
}

// Blocked customers can't log in or order (PRD §14.6); their open logins stop working
export async function setCustomerBlocked(id, body = {}) {
  const block = body.blocked === true;
  const reason = cleanText(body.reason, 300);
  if (block && !reason) throw new HttpError(400, 'Please note why you are blocking this customer (only you see this).');
  const update = block ? { isBlocked: true, blockedReason: reason, blockedAt: new Date() } : { isBlocked: false, $unset: { blockedReason: 1, blockedAt: 1 } };
  const user = await User.findByIdAndUpdate(requireObjectId(id, 'We couldn’t find that customer.'), update, { new: true }).lean();
  if (!user) throw new HttpError(404, 'We couldn’t find that customer.');
  return getCustomerForAdmin(user._id);
}

export async function exportCustomersCsv(query = {}) {
  const users = await User.find(userFilter(query), { name: 1, email: 1, mobile: 1, createdAt: 1, isBlocked: 1 }).sort({ createdAt: -1 }).limit(20000).lean();
  const stats = await orderStats(users.map((u) => u._id));
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  return toCsv(
    ['Name', 'Email', 'Mobile', 'Joined', 'Orders', 'Total spent (₹)', 'Last order', 'Status'],
    users.map((u) => {
      const s = stats.get(String(u._id));
      return [u.name, u.email, u.mobile, day(u.createdAt), s?.orders || 0, Math.round(s?.spent || 0), day(s?.lastOrderAt), u.isBlocked ? 'Blocked' : 'Active'];
    }),
  );
}
