import { Banner, Category, Product, Setting } from '../models/index.js';
import { defaultSettings } from '../config/defaultSettings.js';
import { slugify } from '../utils/text.js';
import { banners, categoryTree, defaultPages, sampleProducts } from './seedData.js';

async function upsertCategories(nodes, parent = null, inherited = {}) {
  for (const [index, node] of nodes.entries()) {
    const { children, ...fields } = node;
    const merged = {
      productType: fields.productType || inherited.productType,
      gender: fields.gender || inherited.gender,
    };
    const category = await Category.findOneAndUpdate(
      { slug: fields.slug },
      { $setOnInsert: { ...fields, ...merged, parent, displayOrder: index + 1 } },
      { upsert: true, new: true },
    );
    if (children) await upsertCategories(children, category._id, merged);
  }
}

// What every store needs before it can open, in development and production:
// the category menu (the /men and /women pages depend on those slugs) and the
// Business Settings record with the policy pages. Sample products and banners
// are NOT added here. Does nothing once Settings exist.
export async function ensureEssentials() {
  if (await Setting.exists({ key: 'business' })) return false;
  await upsertCategories(categoryTree);
  try {
    await Setting.create({ key: 'business', values: defaultSettings, pages: defaultPages });
  } catch (err) {
    if (err.code !== 11000) throw err; // another server created it at the same moment
  }
  return true;
}

// Seeds a fresh development database (adds sample products and banners too).
// The Settings record is written last and marks the seed as complete, so an
// interrupted seed safely resumes on the next start.
export async function seedIfEmpty() {
  if (await Setting.exists({ key: 'business' })) return false;

  await upsertCategories(categoryTree);
  if (!(await Banner.estimatedDocumentCount())) await Banner.insertMany(banners);

  const categories = await Category.find().lean();
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const topLevelOf = (category) => {
    let current = category;
    while (current.parent) current = byId.get(String(current.parent));
    return current;
  };

  for (const sample of sampleProducts) {
    const slug = slugify(sample.name);
    if (await Product.exists({ slug })) continue;
    const subCategory = bySlug.get(sample.subCategory);
    await Product.create({
      ...sample,
      slug,
      category: topLevelOf(subCategory)._id,
      subCategory: subCategory._id,
      status: 'active',
    });
  }

  await Setting.create({ key: 'business', values: defaultSettings, pages: defaultPages });
  return true;
}
