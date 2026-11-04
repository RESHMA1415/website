import mongoose from 'mongoose';
import { Category, Order, Product, SizeChart, StockMovement } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import {
  cleanMediaUrl,
  cleanText,
  escapeRegex,
  isObjectId,
  pageParams,
  requireObjectId,
  requireText,
  slugify,
  toBool,
  toWholeNumber,
} from '../utils/text.js';
import { PRODUCT_TYPES, placementFor } from './categoryService.js';
import { discountPercent } from './pricingService.js';
import { getSettings } from './settingsService.js';

// Admin product management (PRD §5, §14.2)

const MAX_PRICE = 1_000_000;
const MAX_STOCK = 100_000;
const MAX_PHOTOS_PER_COLOUR = 8;
const MAX_VARIANTS = 200;
const FITS = ['slim', 'regular', 'relaxed', 'oversized'];
const ATTRIBUTE_LIMITS = {
  fabric: 120, fit: 20, pattern: 60, sleeve: 60, neck: 60, occasion: 60,
  care: 500, ingredients: 1500, howToUse: 1000, skinType: 120, shelfLife: 60,
};
export const OPTION_KEYS = { beauty: ['shade', 'volume'], default: ['colour', 'size'] };
const optionKeysFor = (type) => (type === 'beauty' ? OPTION_KEYS.beauty : OPTION_KEYS.default);

// ---------- Reading ----------

function summarise(product) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const lowStockVariants = product.variants.filter((v) => v.stock > 0 && v.stock <= (v.lowStockLevel ?? 5)).length;
  const outOfStockVariants = product.variants.filter((v) => v.stock === 0).length;
  const first = product.images?.[0];
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    productType: product.productType,
    category: product.category,
    subCategory: product.subCategory,
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    discountPercent: discountPercent(product.mrp, product.sellingPrice),
    status: product.status,
    isFeatured: product.isFeatured,
    thumbUrl: first ? first.thumbUrl || first.url : '',
    photoCount: product.images?.length || 0,
    variantCount: product.variants.length,
    totalStock,
    lowStockVariants,
    outOfStockVariants,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function categoryAndChildren(id) {
  const ids = [new mongoose.Types.ObjectId(id)];
  for (let frontier = [...ids]; frontier.length; ) {
    const children = await Category.find({ parent: { $in: frontier } }, { _id: 1 }).lean();
    frontier = children.map((c) => c._id);
    ids.push(...frontier);
  }
  return ids;
}

const ADMIN_SORTS = {
  newest: { createdAt: -1 },
  updated: { updatedAt: -1 },
  name: { name: 1 },
  price_asc: { sellingPrice: 1 },
  price_desc: { sellingPrice: -1 },
  stock_asc: { totalStock: 1 },
};

export async function listProductsForAdmin(query) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 25 });
  const match = {};
  if (['active', 'draft', 'hidden'].includes(query.status)) match.status = query.status;
  if (isObjectId(query.category)) {
    const ids = await categoryAndChildren(query.category);
    match.$or = [{ category: { $in: ids } }, { subCategory: { $in: ids } }];
  }
  const q = cleanText(query.q, 100);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    match.$and = [{ $or: [{ name: pattern }, { brand: pattern }, { 'variants.sku': pattern }, { tags: pattern }] }];
  }

  const stockMatch = {};
  if (query.stock === 'out') stockMatch.totalStock = 0;
  if (query.stock === 'low') stockMatch.lowStockVariants = { $gt: 0 };
  if (query.stock === 'any_out') stockMatch.outOfStockVariants = { $gt: 0 };

  const sort = ADMIN_SORTS[query.sort] || ADMIN_SORTS.newest;
  const [result] = await Product.aggregate([
    { $match: match },
    {
      $addFields: {
        totalStock: { $sum: '$variants.stock' },
        lowStockVariants: {
          $size: {
            $filter: {
              input: '$variants',
              cond: { $and: [{ $gt: ['$$this.stock', 0] }, { $lte: ['$$this.stock', { $ifNull: ['$$this.lowStockLevel', 5] }] }] },
            },
          },
        },
        outOfStockVariants: { $size: { $filter: { input: '$variants', cond: { $eq: ['$$this.stock', 0] } } } },
      },
    },
    { $match: stockMatch },
    {
      $facet: {
        items: [{ $sort: { ...sort, _id: 1 } }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const items = result.items;
  await Category.populate(items, [
    { path: 'category', select: 'name' },
    { path: 'subCategory', select: 'name' },
  ]);
  const total = result.total[0]?.count || 0;
  return { items: items.map(summarise), total, page, pages: Math.ceil(total / limit) };
}

export async function getProductForAdmin(id) {
  const product = await Product.findById(requireObjectId(id, 'We couldn’t find that product.')).lean();
  if (!product) throw new HttpError(404, 'We couldn’t find that product.');
  return product;
}

// ---------- Validation ----------

function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map((t) => cleanText(t, 30).toLowerCase()).filter(Boolean))].slice(0, 20);
}

function cleanAttributes(input = {}, productType) {
  const attributes = {};
  for (const [key, max] of Object.entries(ATTRIBUTE_LIMITS)) {
    const value = cleanText(input?.[key], max);
    if (value) attributes[key] = value;
  }
  if (attributes.fit) {
    attributes.fit = attributes.fit.toLowerCase();
    if (!FITS.includes(attributes.fit)) throw new HttpError(400, 'Please choose a valid fit.');
  }
  if (productType === 'beauty') {
    for (const key of ['fit', 'pattern', 'sleeve', 'neck']) delete attributes[key];
  }
  return attributes;
}

function cleanImages(input, colours) {
  if (!Array.isArray(input)) return [];
  const images = input.slice(0, 60).map((img) => {
    const url = cleanMediaUrl(img?.url);
    if (!url) throw new HttpError(400, 'One of the photos is missing. Please choose it again.');
    const colour = cleanText(img.colour, 40);
    return {
      url,
      mediumUrl: cleanMediaUrl(img.mediumUrl) || undefined,
      thumbUrl: cleanMediaUrl(img.thumbUrl) || undefined,
      alt: cleanText(img.alt, 150) || undefined,
      colour: colour && colours.includes(colour) ? colour : undefined,
    };
  });
  const perGroup = new Map();
  for (const img of images) {
    const key = img.colour || '';
    perGroup.set(key, (perGroup.get(key) || 0) + 1);
    if (perGroup.get(key) > MAX_PHOTOS_PER_COLOUR) {
      throw new HttpError(400, `You can add up to ${MAX_PHOTOS_PER_COLOUR} photos${key ? ` for ${key}` : ''}.`);
    }
  }
  return images;
}

const comboKey = (options, keys) => keys.map((k) => (options[k] || '').toLowerCase()).join('|');

function skuBase(name) {
  const letters = name.replace(/\(sample\)/i, '').replace(/[^a-z0-9 ]/gi, '').trim().split(/\s+/);
  const code = letters.map((w) => w[0]).join('').slice(0, 4).toUpperCase() || 'PRD';
  return `SHM-${code}`;
}
const skuPart = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase();

function cleanVariants(input, { productType, mrp, sellingPrice, lowStockLevel, name }) {
  if (!Array.isArray(input) || !input.length) {
    throw new HttpError(400, 'Add at least one option (for example a size or colour) with its stock.');
  }
  if (input.length > MAX_VARIANTS) throw new HttpError(400, `A product can have at most ${MAX_VARIANTS} options.`);
  const keys = optionKeysFor(productType);
  const seen = new Set();
  return input.map((raw) => {
    const options = {};
    for (const key of keys) {
      const value = cleanText(raw?.options?.[key], 40);
      if (value) options[key] = value;
    }
    if (!Object.keys(options).length) throw new HttpError(400, 'Every option needs a value (for example “M” or “Navy”).');
    if (options.colour) {
      const hex = cleanText(raw.options.colourHex, 7);
      if (hex && !/^#[0-9a-f]{6}$/i.test(hex)) throw new HttpError(400, `Please pick a valid swatch colour for ${options.colour}.`);
      if (hex) options.colourHex = hex.toUpperCase();
    }
    const key = comboKey(options, keys);
    const label = keys.map((k) => options[k]).filter(Boolean).join(' / ');
    if (seen.has(key)) throw new HttpError(400, `The option “${label}” appears twice.`);
    seen.add(key);

    const variantMrp = toWholeNumber(raw.mrp, `MRP for ${label}`, { min: 1, max: MAX_PRICE, optional: true });
    const price = toWholeNumber(raw.price, `price for ${label}`, { min: 1, max: MAX_PRICE, optional: true });
    const effectiveMrp = variantMrp ?? mrp;
    if ((price ?? sellingPrice) > effectiveMrp) {
      throw new HttpError(400, `The price for ${label} cannot be more than its MRP.`);
    }
    if (variantMrp !== undefined && price === undefined && sellingPrice > variantMrp) {
      throw new HttpError(400, `The MRP for ${label} cannot be lower than the selling price.`);
    }

    let sku = cleanText(raw.sku, 40).toUpperCase().replace(/\s+/g, '-');
    if (sku && !/^[A-Z0-9][A-Z0-9_-]*$/.test(sku)) {
      throw new HttpError(400, `The SKU “${sku}” can only use letters, numbers, - and _.`);
    }
    if (!sku) sku = [skuBase(name), ...keys.map((k) => skuPart(options[k])).filter(Boolean)].join('-');

    return {
      _id: isObjectId(raw._id) ? raw._id : undefined,
      options,
      sku,
      stock: toWholeNumber(raw.stock ?? 0, `stock for ${label}`, { max: MAX_STOCK }),
      stockLoaded: raw.stockLoaded === undefined ? undefined : Number(raw.stockLoaded),
      lowStockLevel,
      price,
      mrp: variantMrp,
    };
  });
}

// Auto-generated SKUs get a number when they clash; typed ones must be unique
async function ensureUniqueSkus(variants, productId) {
  const taken = new Set();
  const others = await Product.find(
    { _id: { $ne: productId }, 'variants.sku': { $in: variants.map((v) => new RegExp(`^${escapeRegex(v.sku)}(-\\d+)?$`)) } },
    { 'variants.sku': 1, name: 1 },
  ).lean();
  const usedElsewhere = new Map(others.flatMap((p) => p.variants.map((v) => [v.sku, p.name])));
  for (const variant of variants) {
    let { sku } = variant;
    for (let n = 2; usedElsewhere.has(sku) || taken.has(sku); n += 1) sku = `${variant.sku}-${n}`;
    taken.add(sku);
    variant.sku = sku;
  }
}

async function buildProductFields(body, existing) {
  const name = requireText(body.name, 'product name', 120);
  const placement = await placementFor(body.subCategory || body.category);
  const productType = cleanText(body.productType, 20) || placement.productType;
  if (!PRODUCT_TYPES.includes(productType)) throw new HttpError(400, 'Please choose the product type.');

  const mrp = toWholeNumber(body.mrp, 'MRP', { min: 1, max: MAX_PRICE });
  const sellingPrice = toWholeNumber(body.sellingPrice, 'selling price', { min: 1, max: MAX_PRICE });
  if (sellingPrice > mrp) throw new HttpError(400, 'The selling price cannot be more than the MRP.');

  const { orders } = await getSettings();
  const lowStockLevel = toWholeNumber(body.lowStockLevel ?? orders.lowStockDefault, 'low-stock alert level', { max: 10_000 });
  const variants = cleanVariants(body.variants, { productType, mrp, sellingPrice, lowStockLevel, name });
  const colours = [...new Set(variants.map((v) => v.options.colour).filter(Boolean))];
  const images = cleanImages(body.images, colours);

  const status = ['draft', 'active', 'hidden'].includes(body.status) ? body.status : 'draft';
  if (status === 'active' && !images.length) {
    throw new HttpError(400, 'Add at least one photo before making this product visible to customers. You can save it as a Draft for now.');
  }

  let sizeChart;
  if (body.sizeChart) {
    sizeChart = requireObjectId(body.sizeChart, 'Please choose a valid size chart.');
    if (!(await SizeChart.exists({ _id: sizeChart }))) throw new HttpError(400, 'Please choose a valid size chart.');
  }

  const shortDescription = requireText(body.shortDescription, 'short description', 300);
  const requestedSlug = slugify(body.slug);
  let slug = existing && (!requestedSlug || requestedSlug === existing.slug) ? existing.slug : requestedSlug || slugify(name) || 'product';
  if (slug !== existing?.slug) {
    const base = slug;
    for (let n = 2; await Product.exists({ slug, _id: { $ne: existing?._id } }); n += 1) slug = `${base}-${n}`;
  }

  return {
    fields: {
      name,
      slug,
      category: placement.category,
      subCategory: placement.subCategory || null,
      gender: placement.gender,
      productType,
      brand: cleanText(body.brand, 60) || null,
      shortDescription,
      description: requireText(body.description, 'full description', 10_000),
      mrp,
      sellingPrice,
      attributes: cleanAttributes(body.attributes, productType),
      sizeChart: sizeChart || null,
      images,
      videoUrl: cleanMediaUrl(body.videoUrl) || null,
      tags: cleanTags(body.tags),
      isReturnable: body.isReturnable === undefined ? productType !== 'beauty' : toBool(body.isReturnable),
      isFeatured: toBool(body.isFeatured),
      isNewArrival: toBool(body.isNewArrival),
      status,
      seo: {
        title: cleanText(body.seo?.title, 70) || name.slice(0, 70),
        description: cleanText(body.seo?.description, 160) || shortDescription.slice(0, 160),
      },
    },
    variants,
    // The form shows one level for the whole product. Only push it onto every
    // existing option when the admin actually changed it; otherwise keep the
    // per-option levels set in Inventory or by CSV import.
    applyLowStockToAll: body.lowStockLevelLoaded === undefined || Number(body.lowStockLevelLoaded) !== lowStockLevel,
  };
}

// ---------- Writing ----------

async function logMovements(product, movements) {
  const docs = movements
    .filter((m) => m.change !== 0)
    .map((m) => ({ product: product._id, variantId: m.variantId, sku: m.sku, change: m.change, stockAfter: m.stockAfter, reason: m.reason, note: m.note }));
  if (docs.length) await StockMovement.insertMany(docs);
}

export async function createProduct(body) {
  const { fields, variants } = await buildProductFields(body, null);
  for (const v of variants) delete v._id;
  await ensureUniqueSkus(variants);
  const product = await Product.create({ ...fields, variants: variants.map(({ stockLoaded, ...v }) => v) });
  await logMovements(
    product,
    product.variants.map((v) => ({ variantId: v._id, sku: v.sku, change: v.stock, stockAfter: v.stock, reason: 'new_stock', note: 'Opening stock' })),
  );
  return product.toObject();
}

export async function updateProduct(id, body) {
  const productId = requireObjectId(id, 'We couldn’t find that product.');
  // Optimistic save: if an order changes stock while we work, start again
  // from the fresh numbers so no sale is ever overwritten
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await Product.findById(productId).lean();
    if (!current) throw new HttpError(404, 'We couldn’t find that product.');
    const { fields, variants, applyLowStockToAll } = await buildProductFields(body, current);
    await ensureUniqueSkus(variants, current._id);

    const currentById = new Map(current.variants.map((v) => [String(v._id), v]));
    const movements = [];
    const nextVariants = variants.map(({ stockLoaded, ...v }) => {
      const before = v._id && currentById.get(String(v._id));
      if (!before) {
        const _id = new mongoose.Types.ObjectId();
        movements.push({ variantId: _id, sku: v.sku, change: v.stock, stockAfter: v.stock, reason: 'new_stock', note: 'New option added' });
        return { ...v, _id };
      }
      // Apply only what the admin changed on the form, on top of live stock
      const change = Number.isFinite(stockLoaded) ? v.stock - stockLoaded : v.stock - before.stock;
      const stock = Math.min(MAX_STOCK, Math.max(0, before.stock + change));
      movements.push({ variantId: before._id, sku: v.sku, change: stock - before.stock, stockAfter: stock, reason: 'correction', note: 'Edited on the product form' });
      const lowStockLevel = applyLowStockToAll ? v.lowStockLevel : before.lowStockLevel ?? v.lowStockLevel;
      return { ...v, _id: before._id, stock, lowStockLevel };
    });

    const updated = await Product.findOneAndUpdate(
      { _id: current._id, updatedAt: current.updatedAt },
      { $set: { ...fields, variants: nextVariants } },
      { new: true, runValidators: true },
    ).lean();
    if (updated) {
      await logMovements(updated, movements);
      return updated;
    }
  }
  throw new HttpError(409, 'This product was changed by an order while you were editing. Please reload and try again.');
}

export async function duplicateProduct(id) {
  const source = await getProductForAdmin(id);
  const { _id, createdAt, updatedAt, __v, ratingAverage, ratingCount, ratingBreakdown, unitsSold, ...rest } = source;
  const name = `${source.name.replace(/\s*\(Copy( \d+)?\)$/, '')} (Copy)`.slice(0, 120);
  let slug = slugify(name);
  for (let n = 2; await Product.exists({ slug }); n += 1) slug = `${slugify(name)}-${n}`;
  const variants = source.variants.map(({ _id: vid, ...v }) => ({ ...v, stock: 0 }));
  await ensureUniqueSkus(variants);
  const copy = await Product.create({ ...rest, name, slug, status: 'draft', isFeatured: false, variants });
  return copy.toObject();
}

// Products with orders are hidden instead, so order history stays intact
export async function deleteProduct(id) {
  const product = await getProductForAdmin(id);
  if (await Order.exists({ 'items.product': product._id })) {
    await Product.updateOne({ _id: product._id }, { status: 'hidden' });
    return { hidden: true };
  }
  await Product.deleteOne({ _id: product._id });
  await StockMovement.deleteMany({ product: product._id });
  return { deleted: true };
}

export async function bulkUpdateProducts({ ids, action, subCategory }) {
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Please select at least one product.');
  const productIds = ids.slice(0, 200).filter(isObjectId);
  const result = { updated: 0, skipped: [], hidden: 0, deleted: 0 };

  if (action === 'activate') {
    const products = await Product.find({ _id: { $in: productIds } }, { name: 1, images: 1 }).lean();
    const ready = products.filter((p) => p.images?.length);
    result.skipped = products.filter((p) => !p.images?.length).map((p) => `${p.name} (needs a photo)`);
    result.updated = (await Product.updateMany({ _id: { $in: ready.map((p) => p._id) } }, { status: 'active' })).modifiedCount;
  } else if (action === 'hide' || action === 'draft') {
    result.updated = (await Product.updateMany({ _id: { $in: productIds } }, { status: action === 'hide' ? 'hidden' : 'draft' })).modifiedCount;
  } else if (action === 'category') {
    const placement = await placementFor(subCategory);
    const products = await Product.find({ _id: { $in: productIds } }, { name: 1, productType: 1 }).lean();
    // Changing between beauty and clothing would break the size/shade options
    const keysFor = (t) => optionKeysFor(t).join();
    const fits = products.filter((p) => !placement.productType || keysFor(p.productType) === keysFor(placement.productType));
    result.skipped = products.filter((p) => !fits.includes(p)).map((p) => `${p.name} (different product type)`);
    result.updated = (
      await Product.updateMany(
        { _id: { $in: fits.map((p) => p._id) } },
        { category: placement.category, subCategory: placement.subCategory || null, gender: placement.gender },
      )
    ).modifiedCount;
  } else if (action === 'delete') {
    for (const id of productIds) {
      const outcome = await deleteProduct(id).catch(() => null);
      if (outcome?.hidden) result.hidden += 1;
      if (outcome?.deleted) result.deleted += 1;
    }
  } else {
    throw new HttpError(400, 'Please choose what to do with the selected products.');
  }
  return result;
}
