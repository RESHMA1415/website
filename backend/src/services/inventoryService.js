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
const IMPORT_BATCH = 20; // sheet rows written at the same time

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

// Changes a variant's stock and/or low-stock level.
// When `stockLoaded` (the number the admin saw) is given, only the admin's
// change (stock − stockLoaded) is applied on top of the live stock, so sales
// made after the screen or sheet was loaded are never overwritten. Without it,
// `stock` is set exactly. Each write only succeeds if stock is still what we
// read (compare-and-set), so the logged change is always exact.
function cleanStockChange({ stock, stockLoaded, lowStockLevel, reason }) {
  const wantedStock = stock === undefined ? undefined : toWholeNumber(stock, 'stock', { max: MAX_STOCK });
  const loaded = stockLoaded === undefined || stockLoaded === null || stockLoaded === '' ? undefined : toWholeNumber(stockLoaded, 'stock', { max: MAX_STOCK });
  if (wantedStock !== undefined) checkReason(reason);
  const level = lowStockLevel === undefined ? undefined : toWholeNumber(lowStockLevel, 'low-stock alert level', { max: 10_000 });
  if (wantedStock === undefined && level === undefined) throw new HttpError(400, 'Nothing to change.');
  return { wantedStock, loaded, level };
}

// Works out the new values for one variant from its live state
function planStockChange(old, { wantedStock, loaded, level }) {
  let nextStock = old.stock;
  if (wantedStock !== undefined) {
    nextStock = loaded === undefined ? wantedStock : old.stock + (wantedStock - loaded);
    nextStock = Math.min(MAX_STOCK, Math.max(0, nextStock));
  }
  const update = {};
  if (nextStock !== old.stock) update['variants.$.stock'] = nextStock;
  if (level !== undefined && level !== old.lowStockLevel) update['variants.$.lowStockLevel'] = level;
  return { nextStock, level: level ?? old.lowStockLevel, update, changed: Object.keys(update).length > 0 };
}

// Compare-and-set write: only applies if the variant's stock is still `oldStock`
async function writeStockChange(pid, vid, oldStock, update) {
  const saved = await Product.updateOne({ _id: pid, variants: { $elemMatch: { _id: vid, stock: oldStock } } }, { $set: update });
  return saved.modifiedCount > 0;
}

function movementDoc(pid, old, nextStock, reason, note) {
  return { product: pid, variantId: old._id, sku: old.sku, change: nextStock - old.stock, stockAfter: nextStock, reason, note: cleanText(note, 200) || undefined };
}

export async function setVariantStock(productId, variantId, { stock, stockLoaded, lowStockLevel, reason, note }) {
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const vid = requireObjectId(variantId, 'We couldn’t find that option.');
  const wanted = cleanStockChange({ stock, stockLoaded, lowStockLevel, reason });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await Product.findOne({ _id: pid, 'variants._id': vid }, { 'variants.$': 1 }).lean();
    const old = current?.variants?.[0];
    if (!old) throw new HttpError(404, 'We couldn’t find that option. It may have been removed.');

    const plan = planStockChange(old, wanted);
    if (!plan.changed) return { stock: old.stock, lowStockLevel: old.lowStockLevel, changed: false };
    // Stock moved (e.g. an order) between read and write: read again and retry
    if (!(await writeStockChange(pid, vid, old.stock, plan.update))) continue;

    if (plan.nextStock !== old.stock) await StockMovement.create(movementDoc(pid, old, plan.nextStock, reason, note));
    return { stock: plan.nextStock, lowStockLevel: plan.level, changed: true };
  }
  throw new HttpError(409, 'Stock for this option is changing right now. Please reload and try again.');
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

// "Stock when downloaded" lets the upload apply only the owner's edits, so
// orders that sold stock after the download are not undone
const LOADED_HEADER = 'Stock when downloaded (don’t edit)';
const CSV_HEADERS = ['SKU', 'Product', 'Option', 'Stock', 'Low-stock level', 'Price (₹)', 'Product status', LOADED_HEADER];

export async function exportInventoryCsv(query) {
  const rows = await Product.aggregate([...(await variantPipeline(query)), { $sort: { name: 1, 'variant.sku': 1 } }]);
  return toCsv(
    CSV_HEADERS,
    rows.map(shapeRow).map((r) => [r.sku, r.productName, r.optionLabel, r.stock, r.lowStockLevel, r.price, r.productStatus, r.stock]),
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
  const loadedCol = header.findIndex((h) => h.startsWith('stock when downloaded'));
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
      const loadedText = loadedCol >= 0 ? row[loadedCol]?.trim() : '';
      const stockLoaded = loadedText ? toWholeNumber(loadedText, `“Stock when downloaded” on row ${line}`, { max: MAX_STOCK }) : undefined;
      if (wanted.has(sku)) throw new HttpError(400, `SKU ${sku} appears more than once (row ${line}).`);
      wanted.set(sku, { stock, stockLoaded, lowStockLevel, line });
    } catch (err) {
      errors.push(err.message);
    }
  });

  // One read loads every option on the sheet with its live stock
  const products = await Product.find(
    { 'variants.sku': { $in: [...wanted.keys()] } },
    { 'variants._id': 1, 'variants.sku': 1, 'variants.stock': 1, 'variants.lowStockLevel': 1 },
  ).lean();
  const located = new Map(products.flatMap((p) => p.variants.map((v) => [v.sku, { pid: p._id, variant: v }])));

  const note = 'Bulk update (CSV)';
  const movements = [];
  let updated = 0;
  let unchanged = 0;
  const jobs = [];
  for (const [sku, { line, ...values }] of wanted) {
    const target = located.get(sku);
    if (!target) {
      errors.push(`Row ${line}: no product option has the SKU ${sku}.`);
      continue;
    }
    jobs.push({ sku, line, values, ...target });
  }

  // Writes run a few at a time. Each is compare-and-set against the stock we
  // read; if an order changed it meanwhile, that row is redone from live stock.
  const runJob = async ({ sku, line, values, pid, variant }) => {
    try {
      const plan = planStockChange(variant, cleanStockChange({ ...values, reason }));
      if (!plan.changed) {
        unchanged += 1;
        return;
      }
      if (await writeStockChange(pid, variant._id, variant.stock, plan.update)) {
        if (plan.nextStock !== variant.stock) movements.push(movementDoc(pid, variant, plan.nextStock, reason, note));
        updated += 1;
        return;
      }
      const result = await setVariantStock(String(pid), String(variant._id), { ...values, reason, note });
      if (result.changed) updated += 1;
      else unchanged += 1;
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      errors.push(`Row ${line} (${sku}): ${err.message}`);
    }
  };
  for (let i = 0; i < jobs.length; i += IMPORT_BATCH) {
    await Promise.all(jobs.slice(i, i + IMPORT_BATCH).map(runJob));
  }
  if (movements.length) await StockMovement.insertMany(movements);
  return { updated, unchanged, errors: errors.slice(0, 50), errorCount: errors.length };
}
