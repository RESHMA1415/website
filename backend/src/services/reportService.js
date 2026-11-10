
import { Category, ContactMessage, Order, Payment, Product, ReturnRequest, Review, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { toCsv } from '../utils/csv.js';
import { inventoryCounts, listInventory } from './inventoryService.js';
import { optionText } from './orderNotifications.js';
import { lowStockDefault } from './settingsService.js';

// Dashboard and Sales Reports (PRD §14.1, §14.10).
// Sales rule (§14.1): orders that reached Confirmed, excluding Cancelled, minus
// refunded amounts. COD counts once confirmed; "COD collected" = delivered COD.
// Dates are India days (Asia/Kolkata).

const TZ = 'Asia/Kolkata';
const IST = 5.5 * 3600 * 1000;
const DAY = 86400000;

const indiaToday = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const startOfIndiaDay = (ymd) => new Date(`${ymd}T00:00:00+05:30`);

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (India dates, both included). Default: last 30 days.
export function dateRange(query = {}) {
  const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const toDay = ok(query.to) ? query.to : indiaToday();
  const fromDay = ok(query.from) ? query.from : new Date(startOfIndiaDay(toDay).getTime() - 29 * DAY + IST).toISOString().slice(0, 10);
  const start = startOfIndiaDay(fromDay);
  const end = new Date(startOfIndiaDay(toDay).getTime() + DAY);
  if (end <= start) throw new HttpError(400, 'The end date must be on or after the start date.');
  if (end - start > 3 * 366 * DAY) throw new HttpError(400, 'Please choose a range of up to 3 years.');
  return { from: fromDay, to: toDay, start, end };
}

const placed = { 'statusHistory.status': 'confirmed' };
// Orders that count as sales in a period (by the date the order was placed)
const salesMatch = (r) => ({ ...placed, status: { $ne: 'cancelled' }, createdAt: { $gte: r.start, $lt: r.end } });
const net = { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] };
const round = (n) => Math.round(n || 0);

// ---------- Sales summary ----------
export async function salesSummary(r) {
  const [row] = await Order.aggregate([
    { $match: salesMatch(r) },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        gross: { $sum: '$total' },
        refunds: { $sum: { $ifNull: ['$refundedAmount', 0] } },
        delivery: { $sum: '$deliveryCharge' },
        cod: { $sum: '$codCharge' },
        items: { $sum: { $sum: '$items.quantity' } },
      },
    },
  ]);
  const [codCollected] = await Order.aggregate([
    { $match: { ...salesMatch(r), paymentMethod: 'cod', 'statusHistory.status': 'delivered' } },
    { $group: { _id: null, amount: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  const gross = round(row?.gross);
  const refunds = round(row?.refunds);
  const orders = row?.orders || 0;
  const netSales = gross - refunds;
  return {
    orders,
    units: row?.items || 0,
    grossSales: gross,
    refunds,
    netSales,
    averageOrderValue: orders ? round(netSales / orders) : 0,
    deliveryCharges: round(row?.delivery),
    codCharges: round(row?.cod),
    codCollected: round(codCollected?.amount),
  };
}

// ---------- Over time (day / week / month) ----------
const PERIOD_FORMAT = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' };

export async function salesOverTime(r, by = 'day') {
  const format = PERIOD_FORMAT[by] || PERIOD_FORMAT.day;
  const rows = await Order.aggregate([
    { $match: salesMatch(r) },
    { $group: { _id: { $dateToString: { format, date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 }, sales: { $sum: net } } },
    { $sort: { _id: 1 } },
  ]);
  const byKey = new Map(rows.map((x) => [x._id, x]));
  if (by !== 'day') return rows.map((x) => ({ period: x._id, orders: x.orders, sales: round(x.sales) }));
  // Every day in the range, including days with no sales (so the line is honest)
  const out = [];
  for (let t = r.start.getTime(); t < r.end.getTime(); t += DAY) {
    const key = new Date(t + IST).toISOString().slice(0, 10);
    const x = byKey.get(key);
    out.push({ period: key, orders: x?.orders || 0, sales: round(x?.sales) });
  }
  return out;
}

// ---------- Products, variants, categories ----------
export async function salesByProduct(r, { limit = 100 } = {}) {
  const rows = await Order.aggregate([
    { $match: salesMatch(r) },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $last: '$items.name' }, units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
  return rows.map((x) => ({ productId: x._id, name: x.name, units: x.units, revenue: round(x.revenue) }));
}

export async function salesByVariant(r, { limit = 200 } = {}) {
  const rows = await Order.aggregate([
    { $match: salesMatch(r) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.variantId',
        name: { $last: '$items.name' },
        sku: { $last: '$items.sku' },
        options: { $last: '$items.options' },
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { units: -1 } },
    { $limit: limit },
  ]);
  return rows.map((x) => ({ name: x.name, option: optionText(x.options), sku: x.sku, units: x.units, revenue: round(x.revenue) }));
}

export async function salesByCategory(r) {
  const rows = await Order.aggregate([
    { $match: salesMatch(r) },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p', pipeline: [{ $project: { category: 1, subCategory: 1 } }] } },
    { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
    { $group: { _id: { $ifNull: ['$p.subCategory', '$p.category'] }, units: { $sum: '$units' }, revenue: { $sum: '$revenue' } } },
    { $sort: { revenue: -1 } },
  ]);
  const cats = await Category.find({ _id: { $in: rows.map((x) => x._id).filter(Boolean) } }, { name: 1, parent: 1 }).populate('parent', 'name').lean();
  const names = new Map(cats.map((c) => [String(c._id), c.parent?.name ? `${c.parent.name} › ${c.name}` : c.name]));
  return rows.map((x) => ({ category: x._id ? names.get(String(x._id)) || 'Deleted category' : 'Deleted product', units: x.units, revenue: round(x.revenue) }));
}

// ---------- Payment methods ----------
export async function paymentMethods(r) {
  const split = await Order.aggregate([
    { $match: salesMatch(r) },
    { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, sales: { $sum: net } } },
  ]);
  const online = await Payment.aggregate([
    { $match: { provider: 'razorpay', status: { $in: ['paid', 'partially_refunded', 'refunded', 'refund_initiated'] }, createdAt: { $gte: r.start, $lt: r.end } } },
    { $group: { _id: { $ifNull: ['$method', 'other'] }, payments: { $sum: 1 }, amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
  ]);
  const pick = (m) => split.find((x) => x._id === m);
  const NAMES = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', other: 'Other' };
  return {
    split: [
      { method: 'Online', orders: pick('online')?.orders || 0, sales: round(pick('online')?.sales) },
      { method: 'Cash on Delivery', orders: pick('cod')?.orders || 0, sales: round(pick('cod')?.sales) },
    ],
    online: online.map((x) => ({ type: NAMES[x._id] || x._id, payments: x.payments, amount: round(x.amount) })),
  };
}

// ---------- Returns ----------
const RETURN_REASON = { size_doesnt_fit: 'Size doesn’t fit', damaged: 'Damaged', wrong_item: 'Wrong item received', quality_not_expected: 'Quality not as expected', colour_different: 'Colour different', other: 'Other' };

export async function returnsReport(r) {
  const match = { createdAt: { $gte: r.start, $lt: r.end } };
  const [byReason, byType, totals, delivered] = await Promise.all([
    ReturnRequest.aggregate([{ $match: match }, { $group: { _id: '$reason', requests: { $sum: 1 } } }, { $sort: { requests: -1 } }]),
    ReturnRequest.aggregate([{ $match: match }, { $group: { _id: '$type', requests: { $sum: 1 } } }]),
    ReturnRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          units: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 0, { $sum: '$items.quantity' }] } },
          refunded: { $sum: { $ifNull: ['$refundedAmount', 0] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { 'shipping.deliveredAt': { $gte: r.start, $lt: r.end } } },
      { $group: { _id: null, units: { $sum: { $sum: '$items.quantity' } } } },
    ]),
  ]);
  const t = totals[0] || {};
  const deliveredUnits = delivered[0]?.units || 0;
  return {
    requests: t.requests || 0,
    rejected: t.rejected || 0,
    returnedUnits: t.units || 0,
    deliveredUnits,
    // PRD §14.10: returned units ÷ delivered units × 100
    returnRate: deliveredUnits ? Math.round(((t.units || 0) / deliveredUnits) * 1000) / 10 : 0,
    refunded: round(t.refunded),
    byReason: byReason.map((x) => ({ reason: RETURN_REASON[x._id] || x._id, requests: x.requests })),
    byType: byType.map((x) => ({ type: x._id === 'exchange' ? 'Exchange' : 'Return', requests: x.requests })),
  };
}

// ---------- Customers ----------
export async function customersReport(r) {
  const [newCustomers, buyers, top] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: r.start, $lt: r.end } }),
    Order.aggregate([
      { $match: salesMatch(r) },
      { $group: { _id: '$user' } },
      { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'earlier', pipeline: [{ $match: { ...placed, createdAt: { $lt: r.start } } }, { $limit: 1 }, { $project: { _id: 1 } }] } },
      { $group: { _id: null, buyers: { $sum: 1 }, returning: { $sum: { $cond: [{ $gt: [{ $size: '$earlier' }, 0] }, 1, 0] } } } },
    ]),
    Order.aggregate([
      { $match: salesMatch(r) },
      { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: net }, name: { $last: '$address.fullName' } } },
      { $sort: { spent: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, email: 1 } }] } },
    ]),
  ]);
  const b = buyers[0] || { buyers: 0, returning: 0 };
  return {
    newCustomers,
    buyers: b.buyers,
    returningBuyers: b.returning,
    firstTimeBuyers: b.buyers - b.returning,
    top: top.map((x) => ({ customerId: x._id, name: x.u[0]?.name || x.name || 'Deleted account', email: x.u[0]?.email || '', orders: x.orders, spent: round(x.spent) })),
  };
}

// ---------- Inventory ----------
export async function inventoryReport() {
  const fallback = await lowStockDefault();
  const [value] = await Product.aggregate([
    { $match: { status: { $ne: 'hidden' } } },
    { $unwind: '$variants' },
    {
      $group: {
        _id: null,
        variants: { $sum: 1 },
        units: { $sum: '$variants.stock' },
        value: { $sum: { $multiply: ['$variants.stock', { $ifNull: ['$variants.price', '$sellingPrice'] }] } },
      },
    },
  ]);
  const [counts, out, low] = await Promise.all([inventoryCounts(), listInventory({ stock: 'out', limit: 100 }), listInventory({ stock: 'low', limit: 100 })]);
  const row = (x) => ({ productId: x.productId, variantId: x.variantId, product: x.productName, option: x.optionLabel, sku: x.sku, stock: x.stock, level: x.lowStockLevel });
  return {
    stockValue: round(value?.value),
    units: value?.units || 0,
    variants: value?.variants || 0,
    lowCount: counts.low,
    outCount: counts.out,
    defaultLevel: fallback,
    out: out.items.map(row),
    low: low.items.map(row),
  };
}

// ---------- Cancellations ----------
export async function cancellationsReport(r) {
  const match = { status: 'cancelled', ...placed, 'cancellation.at': { $gte: r.start, $lt: r.end } };
  const [rows, byWho] = await Promise.all([
    Order.find(match, { orderNumber: 1, total: 1, paymentMethod: 1, cancellation: 1, 'address.fullName': 1 }).sort({ 'cancellation.at': -1 }).limit(500).lean(),
    Order.aggregate([{ $match: match }, { $group: { _id: '$cancellation.by', orders: { $sum: 1 }, amount: { $sum: '$total' } } }]),
  ]);
  const WHO = { customer: 'By customer', admin: 'By you', system: 'Automatic (unpaid or sold out)' };
  // Customer reasons start with the chosen option ("Changed my mind: …")
  const reasons = new Map();
  for (const o of rows) {
    const key = (o.cancellation?.reason || 'No reason').split(':')[0];
    reasons.set(key, (reasons.get(key) || 0) + 1);
  }
  return {
    count: rows.length,
    amount: round(rows.reduce((s, o) => s + o.total, 0)),
    byWho: byWho.map((x) => ({ who: WHO[x._id] || x._id, orders: x.orders, amount: round(x.amount) })),
    byReason: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, orders]) => ({ reason, orders })),
    orders: rows.map((o) => ({ orderNumber: o.orderNumber, customer: o.address?.fullName, date: o.cancellation?.at, by: WHO[o.cancellation?.by] || o.cancellation?.by, reason: o.cancellation?.reason, total: o.total, paymentMethod: o.paymentMethod === 'cod' ? 'COD' : 'Online' })),
  };
}

// ---------- Dashboard (PRD §14.1) ----------
export async function dashboard(query = {}) {
  const r = dateRange(query);
  const [summary, series, statusRows, pay, categories, products, latest, pendingReturns, pendingReviews, newMessages, stock, newCustomers] = await Promise.all([
    salesSummary(r),
    salesOverTime(r, 'day'),
    Order.aggregate([{ $match: placed }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    paymentMethods(r),
    salesByCategory(r),
    salesByProduct(r, { limit: 50 }),
    Order.find(placed, { orderNumber: 1, createdAt: 1, total: 1, status: 1, paymentMethod: 1, 'address.fullName': 1, items: 1 }).sort({ createdAt: -1 }).limit(10).lean(),
    ReturnRequest.countDocuments({ status: { $in: ['requested', 'approved', 'pickup_scheduled', 'received'] } }),
    Review.countDocuments({ status: 'pending' }),
    ContactMessage.countDocuments({ status: 'new' }),
    inventoryCounts(),
    User.countDocuments({ createdAt: { $gte: r.start, $lt: r.end } }),
  ]);
  const status = Object.fromEntries(statusRows.map((x) => [x._id, x.n]));
  return {
    range: { from: r.from, to: r.to },
    summary,
    newCustomers,
    toPack: (status.confirmed || 0) + (status.processing || 0),
    inTransit: (status.shipped || 0) + (status.out_for_delivery || 0),
    pendingReturns,
    pendingReviews,
    newMessages,
    lowStock: stock.low,
    outOfStock: stock.out,
    salesByDay: series,
    ordersByStatus: status,
    paymentSplit: pay.split,
    salesByCategory: categories.slice(0, 8),
    topByUnits: [...products].sort((a, b) => b.units - a.units).slice(0, 5),
    topByRevenue: products.slice(0, 5),
    latestOrders: latest.map((o) => ({ orderNumber: o.orderNumber, createdAt: o.createdAt, customer: o.address?.fullName, total: o.total, status: o.status, paymentMethod: o.paymentMethod, items: o.items.reduce((s, i) => s + i.quantity, 0) })),
  };
}

// ---------- Reports page: one call per report, and CSV for each ----------
export const REPORTS = {
  summary: async (r, q) => ({ summary: await salesSummary(r), series: await salesOverTime(r, q.by) }),
  products: async (r) => ({ products: await salesByProduct(r), variants: await salesByVariant(r) }),
  categories: async (r) => ({ categories: await salesByCategory(r) }),
  payments: async (r) => paymentMethods(r),
  returns: async (r) => returnsReport(r),
  customers: async (r) => customersReport(r),
  inventory: async () => inventoryReport(),
  cancellations: async (r) => cancellationsReport(r),
};

export async function runReport(name, query = {}) {
  const fn = REPORTS[name];
  if (!fn) throw new HttpError(404, 'We couldn’t find that report.');
  const r = dateRange(query);
  return { report: name, range: { from: r.from, to: r.to }, ...(await fn(r, query)) };
}

// Spreadsheet (CSV, opens in Excel) for each report
export async function reportCsv(name, query = {}) {
  const data = await runReport(name, query);
  const range = `${data.range.from}_to_${data.range.to}`;
  const s = data.summary;
  const files = {
    summary: () => toCsv(['Period', 'Orders', 'Net sales (₹)'], data.series.map((x) => [x.period, x.orders, x.sales]).concat([[], ['Gross sales', '', s.grossSales], ['Refunds', '', s.refunds], ['Net sales', '', s.netSales], ['Orders', s.orders, ''], ['Average order value', '', s.averageOrderValue], ['Delivery charges collected', '', s.deliveryCharges], ['COD charges collected', '', s.codCharges], ['COD collected (delivered)', '', s.codCollected]])),
    products: () => toCsv(['Product', 'Option', 'SKU', 'Units', 'Revenue (₹)'], data.variants.map((x) => [x.name, x.option, x.sku, x.units, x.revenue])),
    categories: () => toCsv(['Category', 'Units', 'Revenue (₹)'], data.categories.map((x) => [x.category, x.units, x.revenue])),
    payments: () => toCsv(['Method', 'Orders / payments', 'Amount (₹)'], [...data.split.map((x) => [x.method, x.orders, x.sales]), [], ...data.online.map((x) => [`Online: ${x.type}`, x.payments, x.amount])]),
    returns: () => toCsv(['Reason', 'Requests'], [...data.byReason.map((x) => [x.reason, x.requests]), [], ['Return rate %', data.returnRate], ['Returned units', data.returnedUnits], ['Delivered units', data.deliveredUnits], ['Refunded (₹)', data.refunded]]),
    customers: () => toCsv(['Customer', 'Email', 'Orders', 'Spent (₹)'], [...data.top.map((x) => [x.name, x.email, x.orders, x.spent]), [], ['New customers', data.newCustomers], ['First-time buyers', data.firstTimeBuyers], ['Returning buyers', data.returningBuyers]]),
    inventory: () => toCsv(['Product', 'Option', 'SKU', 'Stock', 'Low-stock level', 'State'], [...data.out.map((x) => [x.product, x.option, x.sku, x.stock, x.level, 'Sold out']), ...data.low.map((x) => [x.product, x.option, x.sku, x.stock, x.level, 'Low']), [], ['Stock value (₹)', data.stockValue]]),
    cancellations: () => toCsv(['Order', 'Customer', 'Cancelled on', 'By', 'Reason', 'Total (₹)', 'Payment'], data.orders.map((x) => [x.orderNumber, x.customer, x.date ? new Date(x.date).toISOString().slice(0, 10) : '', x.by, x.reason, x.total, x.paymentMethod])),
  };
  return { csv: files[name](), filename: `shopme-${name}-${range}.csv` };
}


