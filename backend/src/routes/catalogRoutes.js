import { Router } from 'express';
import { Banner, Category } from '../models/index.js';
import { getProductBySlug, listProducts, productFilters, suggestProducts } from '../services/productService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();

// Category tree for menus and category pages
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await Category.find({ status: 'active' })
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    const byParent = new Map();
    for (const category of categories) {
      const key = String(category.parent || 'root');
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(category);
    }
    const build = (parentKey) =>
      (byParent.get(parentKey) || []).map((c) => ({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        productType: c.productType,
        gender: c.gender,
        imageUrl: c.imageUrl,
        bannerUrl: c.bannerUrl,
        description: c.description,
        showInMenu: c.showInMenu,
        children: build(String(c._id)),
      }));
    res.json(build('root'));
  }),
);

router.get(
  '/banners',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const banners = await Banner.find({
      status: 'active',
      $and: [
        { $or: [{ activeFrom: null }, { activeFrom: { $lte: now } }] },
        { $or: [{ activeTo: null }, { activeTo: { $gte: now } }] },
      ],
    })
      .sort({ displayOrder: 1 })
      .limit(5)
      .lean();
    res.json(banners);
  }),
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    res.json(await listProducts(req.query));
  }),
);

// Sidebar filter choices for the collection being browsed
router.get(
  '/products/filters',
  asyncHandler(async (req, res) => {
    res.json(await productFilters(req.query));
  }),
);

// Search suggestions while typing
router.get(
  '/products/suggest',
  asyncHandler(async (req, res) => {
    res.json(await suggestProducts(req.query.q));
  }),
);

router.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const product = await getProductBySlug(req.params.slug);
    if (!product) throw new HttpError(404, 'This product is no longer available.');
    res.json(product);
  }),
);

export default router;
