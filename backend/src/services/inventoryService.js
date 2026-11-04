import mongoose from 'mongoose';
import { Category, Product, StockMovement } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { cleanText, escapeRegex, isObjectId, pageParams, requireObjectId, toWholeNumber } from '../utils/text.js';

// Inventory management (PRD §5.4, §6.5, §14.5). Stock is per variant and every
// change is recorded in the stock history.

export const MANUAL_REASONS = { new_stock: 'New stock', damaged: 'Damaged', correction: 'Correction' };
const MAX_STOCK = 100_000;
const MAX_IMPORT_ROWS = 10_000;

const optionText = (o = {}) => [o.colour, o.size, o.shade, o.volume].filter(Boolean).join(' / ');

async function categoryIds(id) {
  const ids = [new mongoose.Types.ObjectId(id)];
  for (let frontier = [...ids]; frontier.length; ) {
    const children = await Category.find({ parent: { $in: frontier } }, { _id: 1 }).lean();
    frontier = children.map((c) => c._id);
    ids.push(...frontier);
  }
  return ids;
}

async function variantPipeline(query) {
  const productMatch = {};
  if (isObjectId(query.category)) {
    const ids = await categoryIds(query.category);
    productMatch.$or = [{ category: { $in: ids } }, { subCategory: { $in: ids } }];
  }
  const q = cleanText(query.q, 100);
  const variantMatch = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    variantMatch.$or = [{ name: pattern }, { 'variant.sku': pattern }, { brand: pattern }];
  }
  if (query.stock === 'out') variantMatch['variant.stock'] = 0;
  if (query.stock === 'low') {
    variantMatch['variant.stock'] = { $gt: 0 };
    variantMatch.$expr = { $lte: ['$variant.stock', { $ifNull: ['$variant.lowStockLevel', 5] }] };
  }
  return [
    { $match: productMatch },
    { $project: { name: 1, brand: 1, status: 1, sellingPrice: 1, mrp: 1, images: { $slice: ['$images', 1] }, variant: '$variants' } },
    { $unwind: '$variant' },
    { $match: variantMatch },
  ];
}

function shapeRow(row) {
  const v = row.variant;
  const level = v.lowStockLevel ?? 5;
  return {
    productId: row._id,
    productName: row.name,
    productStatus: row.status,
    thumbUrl: row.images?.[0]?.thumbUrl || row.images?.[0]?.url || '',
    variantId: v._id,
    options: v.options,
    optionLabel: optionText(v.options),
    sku: v.sku,
    stock: v.stock,
    lowStockLevel: level,
    price: v.price ?? row.sellingPrice,
    state: v.stock === 0 ? 'out' : v.stock <= level ? 'low' : 'ok',
  };
}

export async function listInventory(query) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 50, maxLimit: 200 });
  const [result] = await Product.aggregate([
    ...(await variantPipeline(query)),
    {
      $facet: {
        items: [{ $sort: { name: 1, _id: 1, 'variant.sku': 1 } }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const total = result.total[0]?.count || 0;
  return { items: result.items.map(shapeRow), total, page, pages: Math.ceil(total / limit) };
}

// Counts for the filter buttons and dashboard alerts
export async function inventoryCounts() {
  const [counts] = await Product.aggregate([
    { $unwind: '$variants' },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        out: { $sum: { $cond: [{ $eq: ['$variants.stock', 0] }, 1, 0] } },
        low: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$variants.stock', 0] }, { $lte: ['$variants.stock', { $ifNull: ['$variants.lowStockLevel', 5] }] }] }, 1, 0],
          },
        },
      },
    },
  ]);
  return { total: counts?.total || 0, low: counts?.low || 0, out: counts?.out || 0 };
}

function checkReason(reason) {
  if (!MANUAL_REASONS[reason]) throw new HttpError(400, 'Please choose why the stock is changing.');
  return reason;
}

// Sets a variant's stock to an exact number. The update is atomic and the
// old value comes back with it, so the logged change is always exact.
export async function setVariantStock(productId, variantId, { stock, lowStockLevel, reason, note }) {
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const vid = requireObjectId(variantId, 'We couldn’t find that option.');
  const update = {};
  if (stock !== undefined) {
    update['variants.$.stock'] = toWholeNumber(stock, 'stock', { max: MAX_STOCK });
    checkReason(reason);
  }
  if (lowStockLevel !== undefined) update['variants.$.lowStockLevel'] = toWholeNumber(lowStockLevel, 'low-stock alert level', { max: 10_000 });
  if (!Object.keys(update).length) throw new HttpError(400, 'Nothing to change.');

  const before = await Product.findOneAndUpdate({ _id: pid, 'variants._id': vid }, { $set: update }, { new: false }).lean();
  if (!before) throw new HttpError(404, 'We couldn’t find that option. It may have been removed.');
  const old = before.variants.find((v) => String(v._id) === vid);

  if (stock !== undefined && update['variants.$.stock'] !== old.stock) {
    await StockMovement.create({
      product: pid,
      variantId: vid,
      sku: old.sku,
      change: update['variants.$.stock'] - old.stock,
      stockAfter: update['variants.$.stock'],
      reason,
      note: cleanText(note, 200) || undefined,
    });
  }
  return { stock: update['variants.$.stock'] ?? old.stock, lowStockLevel: update['variants.$.lowStockLevel'] ?? old.lowStockLevel };
}

export async function stockHistory(productId, variantId) {
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const vid = requireObjectId(variantId, 'We couldn’t find that option.');
  const movements = await StockMovement.find({ product: pid, variantId: vid })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('order', 'orderNumber')
    .lean();
  return movements.map((m) => ({
    _id: m._id,
    at: m.createdAt,
    change: m.change,
    stockAfter: m.stockAfter,
    reason: m.reason,
    orderNumber: m.order?.orderNumber,
    note: m.note,
  }));
}

const CSV_HEADERS = ['SKU', 'Product', 'Option', 'Stock', 'Low-stock level', 'Price (₹)', 'Product status'];

export async function exportInventoryCsv(query) {
  const rows = await Product.aggregate([...(await variantPipeline(query)), { $sort: { name: 1, 'variant.sku': 1 } }]);
  return toCsv(
    CSV_HEADERS,
    rows.map(shapeRow).map((r) => [r.sku, r.productName, r.optionLabel, r.stock, r.lowStockLevel, r.price, r.productStatus]),
  );
}

// Bulk update from the exported sheet: SKU + Stock (+ optional Low-stock level)
export async function importInventoryCsv(text, { reason }) {
  checkReason(reason);
  const rows = parseCsv(text || '');
  if (rows.length < 2) throw new HttpError(400, 'The file is empty. Please download the inventory sheet, fill in the stock and upload it again.');
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new HttpError(400, `Please upload at most ${MAX_IMPORT_ROWS.toLocaleString('en-IN')} rows at a time.`);

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const skuCol = header.indexOf('sku');
  const stockCol = header.indexOf('stock');
  const levelCol = header.indexOf('low-stock level');
  if (skuCol < 0 || stockCol < 0) {
    throw new HttpError(400, 'The file needs “SKU” and “Stock” columns. Please start from the downloaded inventory sheet.');
  }

  const errors = [];
  const wanted = new Map();
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const sku = (row[skuCol] || '').trim().replace(/^'/, '').toUpperCase();
    if (!sku) return;
    try {
      const stock = toWholeNumber(row[stockCol]?.trim(), `stock on row ${line}`, { max: MAX_STOCK });
      const levelText = levelCol >= 0 ? row[levelCol]?.trim() : '';
      const lowStockLevel = levelText ? toWholeNumber(levelText, `low-stock level on row ${line}`, { max: 10_000 }) : undefined;
      if (wanted.has(sku)) throw new HttpError(400, `SKU ${sku} appears more than once (row ${line}).`);
      wanted.set(sku, { stock, lowStockLevel, line });
    } catch (err) {
      errors.push(err.message);
    }
  });

  const products = await Product.find({ 'variants.sku': { $in: [...wanted.keys()] } }, { 'variants._id': 1, 'variants.sku': 1 }).lean();
  const located = new Map(products.flatMap((p) => p.variants.map((v) => [v.sku, { productId: String(p._id), variantId: String(v._id) }])));

  let updated = 0;
  let unchanged = 0;
  for (const [sku, change] of wanted) {
    const target = located.get(sku);
    if (!target) {
      errors.push(`Row ${change.line}: no product option has the SKU ${sku}.`);
      continue;
    }
    const before = await Product.findOne({ _id: target.productId }, { variants: { $elemMatch: { _id: target.variantId } } }).lean();
    const old = before?.variants?.[0];
    if (old && old.stock === change.stock && (change.lowStockLevel === undefined || change.lowStockLevel === old.lowStockLevel)) {
      unchanged += 1;
      continue;
    }
    await setVariantStock(target.productId, target.variantId, { ...change, reason, note: 'Bulk update (CSV)' });
    updated += 1;
  }
  return { updated, unchanged, errors: errors.slice(0, 50), errorCount: errors.length };
}
