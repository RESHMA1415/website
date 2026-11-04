import { Category, Product } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanMediaUrl, cleanText, requireObjectId, requireText, slugify, toBool, toWholeNumber } from '../utils/text.js';

export const PRODUCT_TYPES = ['clothing', 'fashion', 'beauty', 'accessories'];
const GENDERS = ['men', 'women', 'unisex'];
// e.g. Women › Clothing › Dresses
const MAX_DEPTH = 3;
export const LOCKED_SLUGS = ['men', 'women'];

async function loadAll() {
  const categories = await Category.find().sort({ displayOrder: 1, name: 1 }).lean();
  return { categories, byId: new Map(categories.map((c) => [String(c._id), c])) };
}

function ancestorsOf(category, byId) {
  const chain = [];
  let current = category;
  while (current?.parent) {
    current = byId.get(String(current.parent));
    if (!current) break;
    chain.unshift(current);
  }
  return chain;
}

function descendantIds(id, categories) {
  const ids = [String(id)];
  for (let i = 0; i < ids.length; i += 1) {
    for (const c of categories) if (String(c.parent) === ids[i]) ids.push(String(c._id));
  }
  return ids;
}

// Every category (including hidden ones) as a tree, with product counts
export async function listCategoriesForAdmin() {
  const { categories } = await loadAll();
  const counts = await Product.aggregate([
    { $project: { ids: { $setUnion: [['$category'], { $cond: [{ $ifNull: ['$subCategory', false] }, ['$subCategory'], []] }] } } },
    { $unwind: '$ids' },
    { $group: { _id: '$ids', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  const byParent = new Map();
  for (const c of categories) {
    const key = String(c.parent || 'root');
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  const build = (key, depth) =>
    (byParent.get(key) || []).map((c) => ({
      ...c,
      depth,
      productCount: countById.get(String(c._id)) || 0,
      children: build(String(c._id), depth + 1),
    }));
  return build('root', 0);
}

async function uniqueSlug(base, excludeId) {
  const root = base || 'category';
  let slug = root;
  for (let n = 2; await Category.exists({ slug, _id: { $ne: excludeId } }); n += 1) slug = `${root}-${n}`;
  return slug;
}

export async function saveCategory(id, body) {
  const { categories, byId } = await loadAll();
  const existing = id ? byId.get(requireObjectId(id, 'We couldn’t find that category.')) : null;
  if (id && !existing) throw new HttpError(404, 'We couldn’t find that category.');

  const name = requireText(body.name, 'category name', 60);

  let parent = null;
  if (body.parent) {
    parent = byId.get(requireObjectId(body.parent, 'Please choose a valid parent category.'));
    if (!parent) throw new HttpError(400, 'Please choose a valid parent category.');
    if (existing && descendantIds(existing._id, categories).includes(String(parent._id))) {
      throw new HttpError(400, 'A category can’t be placed inside itself or one of its own sub-categories.');
    }
  }
  const ancestors = parent ? [...ancestorsOf(parent, byId), parent] : [];
  const subtreeDepth = existing
    ? Math.max(...descendantIds(existing._id, categories).map((d) => ancestorsOf(byId.get(d), byId).length - ancestorsOf(existing, byId).length))
    : 0;
  if (ancestors.length + 1 + subtreeDepth > MAX_DEPTH) {
    throw new HttpError(400, `Categories can be at most ${MAX_DEPTH} levels deep (e.g. Women › Clothing › Dresses).`);
  }

  const productType = cleanText(body.productType, 20) || undefined;
  if (productType && !PRODUCT_TYPES.includes(productType)) throw new HttpError(400, 'Please choose a valid product type.');
  const root = ancestors[0];
  const gender = root ? root.gender : cleanText(body.gender, 10) || 'unisex';
  if (!GENDERS.includes(gender)) throw new HttpError(400, 'Please choose who this category is for.');

  const requestedSlug = slugify(body.slug || '');
  // The store's /men and /women pages depend on these two addresses, so they never change
  const lockedSlug = existing && !existing.parent && LOCKED_SLUGS.includes(existing.slug) ? existing.slug : null;
  const slug = lockedSlug || (requestedSlug && requestedSlug === existing?.slug
    ? requestedSlug
    : await uniqueSlug(requestedSlug || slugify(parent ? `${root?.slug || ''} ${name}` : name), existing?._id));

  const fields = {
    name,
    slug,
    parent: parent ? parent._id : null,
    productType: productType || [...ancestors].reverse().find((a) => a.productType)?.productType,
    gender,
    imageUrl: cleanMediaUrl(body.imageUrl),
    bannerUrl: cleanMediaUrl(body.bannerUrl),
    description: cleanText(body.description, 500),
    displayOrder: toWholeNumber(body.displayOrder ?? 0, 'display order', { max: 999 }),
    showInMenu: body.showInMenu === undefined ? true : toBool(body.showInMenu),
    status: body.status === 'hidden' ? 'hidden' : 'active',
  };

  const saved = existing
    ? await Category.findByIdAndUpdate(existing._id, fields, { new: true, runValidators: true })
    : await Category.create(fields);

  // Moving a category under a different top level (e.g. Men → Women) moves its products too
  if (existing && String(existing.parent || '') !== String(fields.parent || '')) {
    const fresh = await loadAll();
    const ids = descendantIds(saved._id, fresh.categories);
    const newRoot = ancestorsOf(fresh.byId.get(String(saved._id)), fresh.byId)[0] || saved;
    await Product.updateMany(
      { subCategory: { $in: ids } },
      { category: newRoot._id, gender: newRoot.gender },
    );
  }
  // Gender follows the top-level category for every sub-category
  if (!parent) {
    const ids = descendantIds(saved._id, (await loadAll()).categories).slice(1);
    if (ids.length) await Category.updateMany({ _id: { $in: ids } }, { gender: saved.gender });
    await Product.updateMany({ category: saved._id }, { gender: saved.gender });
  }
  return saved;
}

export async function deleteCategory(id) {
  const categoryId = requireObjectId(id, 'We couldn’t find that category.');
  const category = await Category.findById(categoryId).lean();
  if (!category) throw new HttpError(404, 'We couldn’t find that category.');
  if (await Category.exists({ parent: categoryId })) {
    throw new HttpError(409, 'This category has sub-categories. Move or delete them first.');
  }
  const products = await Product.countDocuments({ $or: [{ category: categoryId }, { subCategory: categoryId }] });
  if (products) {
    throw new HttpError(409, `This category still has ${products} product${products === 1 ? '' : 's'}. Move them to another category first, or hide the category instead.`);
  }
  await Category.deleteOne({ _id: categoryId });
}

// Resolves the sub-category chosen on the product form into the product's
// main category, sub-category, gender and default product type
export async function placementFor(subCategoryId) {
  const id = requireObjectId(subCategoryId, 'Please choose a category.');
  const { byId } = await loadAll();
  const sub = byId.get(id);
  if (!sub) throw new HttpError(400, 'Please choose a category.');
  const chain = [...ancestorsOf(sub, byId), sub];
  const root = chain[0];
  return {
    category: root._id,
    subCategory: sub._id === root._id ? undefined : sub._id,
    gender: root.gender || 'unisex',
    productType: [...chain].reverse().find((c) => c.productType)?.productType,
  };
}
