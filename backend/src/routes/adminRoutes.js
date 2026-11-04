import express, { Router } from 'express';
import multer from 'multer';
import { MAX_VIDEO_BYTES } from '../integrations/media.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { changeAdminPassword, loginAdmin, publicAdmin } from '../services/adminAuthService.js';
import { deleteCategory, listCategoriesForAdmin, saveCategory } from '../services/categoryService.js';
import {
  deleteBanner,
  deleteSizeChart,
  listBannersForAdmin,
  listSizeCharts,
  reorderBanners,
  saveBanner,
  saveSizeChart,
} from '../services/contentService.js';
import {
  MANUAL_REASONS,
  exportInventoryCsv,
  importInventoryCsv,
  inventoryCounts,
  listInventory,
  setVariantStock,
  stockHistory,
} from '../services/inventoryService.js';
import { deleteMedia, listMedia, uploadMedia } from '../services/mediaService.js';
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  duplicateProduct,
  getProductForAdmin,
  listProductsForAdmin,
  updateProduct,
} from '../services/productAdminService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES, files: 20 } });
const handle = (fn) => asyncHandler(async (req, res) => res.json(await fn(req, res)));

// ----- Login (the only admin route open without a session) -----
router.post('/auth/login', handle((req) => loginAdmin(req.body?.email, req.body?.password)));

router.use(requireAdmin);

router.get('/auth/me', handle((req) => publicAdmin(req.admin)));
router.post(
  '/auth/change-password',
  handle((req) => changeAdminPassword(req.admin._id, req.body?.currentPassword, req.body?.newPassword)),
);

// ----- Categories -----
router.get('/categories', handle((req) => listCategoriesForAdmin(req.query)));
router.post('/categories', handle((req) => saveCategory(null, req.body || {})));
router.put('/categories/:id', handle((req) => saveCategory(req.params.id, req.body || {})));
router.delete('/categories/:id', handle(async (req) => (await deleteCategory(req.params.id), { ok: true })));

// ----- Products -----
router.get('/products', handle((req) => listProductsForAdmin(req.query)));
router.post('/products', handle((req) => createProduct(req.body || {})));
router.post('/products/bulk', handle((req) => bulkUpdateProducts(req.body || {})));
router.get('/products/:id', handle((req) => getProductForAdmin(req.params.id)));
router.put('/products/:id', handle((req) => updateProduct(req.params.id, req.body || {})));
router.post('/products/:id/duplicate', handle((req) => duplicateProduct(req.params.id)));
router.delete('/products/:id', handle((req) => deleteProduct(req.params.id)));

// ----- Inventory -----
router.get('/inventory', handle((req) => listInventory(req.query)));
router.get('/inventory/counts', handle(() => inventoryCounts()));
router.get('/inventory/reasons', handle(() => MANUAL_REASONS));
router.get(
  '/inventory/export',
  asyncHandler(async (req, res) => {
    const csv = await exportInventoryCsv(req.query);
    const date = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="shopme-inventory-${date}.csv"`);
    res.send(csv);
  }),
);
router.post(
  '/inventory/import',
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], limit: '3mb' }),
  handle((req) => importInventoryCsv(req.body, { reason: req.query.reason })),
);
router.patch('/inventory/:productId/:variantId', handle((req) => setVariantStock(req.params.productId, req.params.variantId, req.body || {})));
router.get('/inventory/:productId/:variantId/history', handle((req) => stockHistory(req.params.productId, req.params.variantId, req.query)));

// ----- Media library -----
router.get('/media', handle((req) => listMedia(req.query)));
router.post('/media', upload.array('files', 20), handle((req) => uploadMedia(req.files)));
router.delete('/media/:id', handle(async (req) => (await deleteMedia(req.params.id), { ok: true })));

// ----- Homepage banners -----
router.get('/banners', handle((req) => listBannersForAdmin(req.query)));
router.post('/banners', handle((req) => saveBanner(null, req.body || {})));
router.put('/banners/order', handle((req) => reorderBanners(req.body?.ids)));
router.put('/banners/:id', handle((req) => saveBanner(req.params.id, req.body || {})));
router.delete('/banners/:id', handle(async (req) => (await deleteBanner(req.params.id), { ok: true })));

// ----- Size charts -----
router.get('/size-charts', handle((req) => listSizeCharts(req.query)));
router.post('/size-charts', handle((req) => saveSizeChart(null, req.body || {})));
router.put('/size-charts/:id', handle((req) => saveSizeChart(req.params.id, req.body || {})));
router.delete('/size-charts/:id', handle((req) => deleteSizeChart(req.params.id)));

export default router;
