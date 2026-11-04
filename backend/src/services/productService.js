import { Category, Product } from '../models/index.js';
import { cleanText, escapeRegex } from '../utils/text.js';
import { discountPercent, variantPrice } from './pricingService.js';
import { getSettings } from './settingsService.js';

// Customer-facing catalogue: listing, filters, search and product pages
// (PRD §13.3–§13.5)

const DISCOUNT_RATIO = {
  $cond: [{ $gt: ['$mrp', 0] }, { $divide: [{ $subtract: ['$mrp', '$sellingPrice'] }, '$mrp'] }, 0],
};

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { sellingPrice: 1 },
  price_desc: { sellingPrice: -1 },
  best_selling: { unitsSold: -1, createdAt: -1 },
  top_rated: { ratingAverage: -1, ratingCount: -1 },
  discount: { discountRatio: -1 },
};

const MAX_PAGE_SIZE = 48;
const LIST_FILTERS = ['brand', 'fabric', 'fit', 'occasion', 'skinType'];
const ATTRIBUTE_PATH = { brand: 'brand', fabric: 'attributes.fabric', fit: 'attributes.fit', occasion: 'attributes.occasion', skinType: 'attributes.skinType' };

// Shape a product for the customer website, adding computed fields
export function toPublicProduct(product) {
  const variants = product.variants || [];
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const { discountRatio, ...rest } = product;
  return {
    ...rest,
    discountPercent: discountPercent(product.mrp, product.sellingPrice),
    inStock: totalStock > 0,
    variants: variants.map((variant) => {
      const { mrp, price } = variantPrice(product, variant);
      return { _id: variant._id, options: variant.options, sku: variant.sku, stock: variant.stock, mrp, price };
    }),
  };
}

async function categoryIdsFor(slug) {
  const category = await Category.findOne({ slug, status: 'active' }).lean();
  if (!category) return null;
  const ids = [category._id];
  let frontier = [category._id];
  while (frontier.length) {
    const children = await Category.find({ parent: { $in: frontier } }, { _id: 1 }).lean();
    frontier = children.map((c) => c._id);
    ids.push(...frontier);
  }
  return ids;
}

const listParam = (value) =>
  String(value || '')
    .split(',')
    .map((v) => cleanText(v, 60))
    .filter(Boolean)
    .slice(0, 30);

// "dresses" also finds "Dress", "shirts" finds "Shirt"
function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3);
  if (word.length > 4 && /(sh|ch|ss|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

// Every word must match the name, brand, tag, colour/shade or category
async function searchClauses(q) {
  const words = cleanText(q, 100).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6).map(stem);
  const clauses = [];
  for (const word of words) {
    const pattern = new RegExp(escapeRegex(word), 'i');
    const categories = await Category.find({ name: pattern, status: 'active' }, { _id: 1 }).lean();
    const ids = categories.map((c) => c._id);
    clauses.push({
      $or: [
        { name: pattern },
        { brand: pattern },
        { tags: pattern },
        { 'variants.options.colour': pattern },
        { 'variants.options.shade': pattern },
        ...(ids.length ? [{ category: { $in: ids } }, { subCategory: { $in: ids } }] : []),
      ],
    });
  }
  return clauses;
}

// Filters that define the collection being browsed (category, search…)
async function baseFilter(query) {
  const filter = { status: 'active' };
  const and = [];
  if (query.category) {
    const ids = await categoryIdsFor(String(query.category));
    if (!ids) return null;
    and.push({ $or: [{ category: { $in: ids } }, { subCategory: { $in: ids } }] });
  }
  if (['men', 'women', 'unisex'].includes(query.gender)) filter.gender = query.gender;
  if (query.featured === 'true') filter.isFeatured = true;
  if (query.newArrivals === 'true') {
    const { orders } = await getSettings();
    const since = new Date(Date.now() - orders.newArrivalDays * 24 * 60 * 60 * 1000);
    and.push({ $or: [{ isNewArrival: true }, { createdAt: { $gte: since } }] });
  }
  if (query.q) and.push(...(await searchClauses(query.q)));
  if (and.length) filter.$and = and;
  return filter;
}

// Filters the shopper picks in the sidebar (PRD §13.3)
function refinementFilter(query) {
  const and = [];
  const min = Number(query.minPrice);
  const max = Number(query.maxPrice);
  if (Number.isFinite(min) && min > 0) and.push({ sellingPrice: { $gte: min } });
  if (Number.isFinite(max) && max > 0) and.push({ sellingPrice: { $lte: max } });

  // Size, colour and shade must belong to the same option (and be in stock if asked)
  const variantMatch = {};
  for (const key of ['size', 'colour', 'shade']) {
    const values = listParam(query[key]);
    if (values.length) variantMatch[`options.${key}`] = { $in: values };
  }
  if (query.inStock === 'true') variantMatch.stock = { $gt: 0 };
  if (Object.keys(variantMatch).length) and.push({ variants: { $elemMatch: variantMatch } });

  for (const key of LIST_FILTERS) {
    const values = listParam(query[key]);
    if (values.length) and.push({ [ATTRIBUTE_PATH[key]]: { $in: values } });
  }
  const rating = Number(query.rating);
  if ([3, 4].includes(rating)) and.push({ ratingAverage: { $gte: rating }, ratingCount: { $gt: 0 } });
  const discount = Number(query.discount);
  // floor(ratio × 100) ≥ d is the same as ratio ≥ d/100 for whole numbers
  if ([10, 25, 50].includes(discount)) and.push({ $expr: { $gte: [DISCOUNT_RATIO, discount / 100] } });
  return and;
}

export async function listProducts(query) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.limit)) || 24));
  const filter = await baseFilter(query);
  if (!filter) return { products: [], total: 0, page, pages: 0 };
  const refinements = refinementFilter(query);
  if (refinements.length) filter.$and = [...(filter.$and || []), ...refinements];

  const sortKey = SORTS[query.sort] ? query.sort : 'newest';
  const [result] = await Product.aggregate([
    { $match: filter },
    { $addFields: { discountRatio: DISCOUNT_RATIO } },
    {
      $facet: {
        items: [
          { $sort: { ...SORTS[sortKey], _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { description: 0, seo: 0, ratingBreakdown: 0, attributes: 0 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const total = result.total[0]?.count || 0;
  return { products: result.items.map(toPublicProduct), total, page, pages: Math.ceil(total / limit) };
}

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', 'free size', 'one size'];
function compareSizes(a, b) {
  const ia = SIZE_ORDER.indexOf(a.toLowerCase());
  const ib = SIZE_ORDER.indexOf(b.toLowerCase());
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  const na = parseFloat(a.replace(/[^\d.]/g, ''));
  const nb = parseFloat(b.replace(/[^\d.]/g, ''));
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

// The choices available in the sidebar for the current collection
export async function productFilters(query) {
  const filter = await baseFilter(query);
  const empty = { price: { min: 0, max: 0 }, sizes: [], colours: [], shades: [], brands: [], fabrics: [], fits: [], occasions: [], skinTypes: [], productTypes: [] };
  if (!filter) return empty;
  const [facets] = await Product.aggregate([
    { $match: filter },
    {
      $facet: {
        price: [{ $group: { _id: null, min: { $min: '$sellingPrice' }, max: { $max: '$sellingPrice' } } }],
        sizes: [{ $unwind: '$variants' }, { $group: { _id: '$variants.options.size' } }],
        colours: [{ $unwind: '$variants' }, { $group: { _id: '$variants.options.colour', hex: { $first: '$variants.options.colourHex' } } }],
        shades: [{ $unwind: '$variants' }, { $group: { _id: '$variants.options.shade' } }],
        brands: [{ $group: { _id: '$brand' } }],
        fabrics: [{ $group: { _id: '$attributes.fabric' } }],
        fits: [{ $group: { _id: '$attributes.fit' } }],
        occasions: [{ $group: { _id: '$attributes.occasion' } }],
        skinTypes: [{ $group: { _id: '$attributes.skinType' } }],
        productTypes: [{ $group: { _id: '$productType' } }],
      },
    },
  ]);
  const values = (list) => list.map((x) => x._id).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return {
    price: { min: facets.price[0]?.min || 0, max: facets.price[0]?.max || 0 },
    sizes: facets.sizes.map((x) => x._id).filter(Boolean).sort(compareSizes),
    colours: facets.colours.filter((c) => c._id).map((c) => ({ name: c._id, hex: c.hex })).sort((a, b) => a.name.localeCompare(b.name)),
    shades: values(facets.shades),
    brands: values(facets.brands),
    fabrics: values(facets.fabrics),
    fits: values(facets.fits),
    occasions: values(facets.occasions),
    skinTypes: values(facets.skinTypes),
    productTypes: values(facets.productTypes),
  };
}

// Top 5 matches shown while the shopper types (PRD §13.4)
export async function suggestProducts(q) {
  if (cleanText(q, 100).length < 2) return [];
  const clauses = await searchClauses(q);
  const products = await Product.find(
    { status: 'active', $and: clauses },
    { name: 1, slug: 1, brand: 1, mrp: 1, sellingPrice: 1, images: { $slice: 1 } },
  )
    .sort({ unitsSold: -1, createdAt: -1 })
    .limit(5)
    .lean();
  return products.map((p) => ({
    _id: p._id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp,
    discountPercent: discountPercent(p.mrp, p.sellingPrice),
    thumbUrl: p.images?.[0]?.thumbUrl || p.images?.[0]?.url || '',
  }));
}

export async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug, status: 'active' })
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('sizeChart', 'name type imageUrl columns rows')
    .lean();
  return product ? toPublicProduct(product) : null;
}
