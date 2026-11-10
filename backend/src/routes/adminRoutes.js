import express, { Router } from 'express';
import multer from 'multer';
import { MAX_VIDEO_BYTES } from '../integrations/media.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  changeAdminEmail,
  changeAdminPassword,
  confirmTwoStep,
  disableTwoStep,
  loginAdmin,
  publicAdmin,
  resendAdminLoginCode,
  startTwoStepSetup,
  verifyAdminLoginCode,
} from '../services/adminAuthService.js';
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
import {
  addInternalNote,
  bulkMarkProcessing,
  bulkMarkShipped,
  cancelOrderByAdmin,
  getOrderForAdmin,
  listOrdersForAdmin,
  packingSlips,
  refundOrderByAdmin,
  rtoReceived,
  updateOrderStatus,
  updateShipping,
} from '../services/fulfilmentService.js';
import { deleteMedia, listMedia, uploadMedia } from '../services/mediaService.js';
import { exportPaymentsCsv, listPaymentsForAdmin, refundPaymentByAdmin } from '../services/paymentAdminService.js';
import { dashboard, reportCsv, runReport } from '../services/reportService.js';
import { exportCustomersCsv, getCustomerForAdmin, listCustomersForAdmin, setCustomerBlocked } from '../services/customerAdminService.js';
import { getSettingsForAdmin, saveSettingsSection } from '../services/settingsAdminService.js';
import { getReturnForAdmin, listReturnsForAdmin, returnAction } from '../services/returnService.js';
import { bulkApprove, listReviewsForAdmin, pendingReviewCount, reviewAction } from '../services/reviewService.js';
import { exportSubscribersCsv, listMessagesForAdmin, listSubscribersForAdmin, newMessageCount, updateMessage } from '../services/messageService.js';
import { sendEmail, verifyEmailConnection } from '../integrations/email.js';
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
router.post('/auth/login-code', handle((req) => verifyAdminLoginCode(req.body?.challenge, req.body?.code)));
router.post('/auth/login-code/resend', handle((req) => resendAdminLoginCode(req.body?.challenge)));

router.use(requireAdmin);

router.get('/auth/me', handle((req) => publicAdmin(req.admin)));
router.post('/auth/change-email', handle((req) => changeAdminEmail(req.admin._id, req.body || {})));
router.post('/auth/two-step/start', handle((req) => startTwoStepSetup(req.admin._id)));
router.post('/auth/two-step/confirm', handle((req) => confirmTwoStep(req.admin._id, req.body?.code)));
router.post('/auth/two-step/disable', handle((req) => disableTwoStep(req.admin._id, req.body?.password)));
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

// ----- Orders (PRD §14.7) -----
router.get('/orders', handle((req) => listOrdersForAdmin(req.query)));
router.get('/orders/print', handle((req) => packingSlips(req.query)));
router.post('/orders/bulk/processing', handle((req) => bulkMarkProcessing(req.body || {})));
router.post('/orders/bulk/shipped', handle((req) => bulkMarkShipped(req.body || {})));
router.get('/orders/:orderNumber', handle((req) => getOrderForAdmin(req.params.orderNumber)));
router.post('/orders/:orderNumber/status', handle((req) => updateOrderStatus(req.params.orderNumber, req.body || {})));
router.post('/orders/:orderNumber/shipping', handle((req) => updateShipping(req.params.orderNumber, req.body || {})));
router.post('/orders/:orderNumber/rto-received', handle((req) => rtoReceived(req.params.orderNumber)));
router.post('/orders/:orderNumber/cancel', handle(async (req) => (await cancelOrderByAdmin(req.params.orderNumber, req.body || {}), getOrderForAdmin(req.params.orderNumber))));
router.post('/orders/:orderNumber/notes', handle((req) => addInternalNote(req.params.orderNumber, req.body || {})));
router.post('/orders/:orderNumber/refund', handle((req) => refundOrderByAdmin(req.params.orderNumber, req.body || {})));

// ----- Returns & exchanges (PRD §10.5) -----
router.get('/returns', handle((req) => listReturnsForAdmin(req.query)));
router.get('/returns/:id', handle((req) => getReturnForAdmin(req.params.id)));
router.post('/returns/:id/:action', handle((req) => returnAction(req.params.id, req.params.action, req.body || {})));

// ----- Reviews (PRD §11.3, §14.9) -----
router.get('/reviews', handle((req) => listReviewsForAdmin(req.query)));
router.get('/reviews/pending-count', handle(() => pendingReviewCount()));
router.post('/reviews/bulk-approve', handle((req) => bulkApprove(req.body || {})));
router.post('/reviews/:id/:action', handle((req) => reviewAction(req.params.id, req.params.action, req.body || {})));

// ----- Contact messages and newsletter (PRD §14.12) -----
router.get('/messages', handle((req) => listMessagesForAdmin(req.query)));
router.get('/messages/new-count', handle(() => newMessageCount()));
router.patch('/messages/:id', handle((req) => updateMessage(req.params.id, req.body || {})));
router.get('/newsletter', handle((req) => listSubscribersForAdmin(req.query)));
router.get(
  '/newsletter/export',
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="shopme-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(await exportSubscribersCsv());
  }),
);

// ----- Email connection check (admin Account page) -----
router.get('/email/status', handle(() => verifyEmailConnection()));
router.post(
  '/email/test',
  handle(async (req) => {
    const status = await verifyEmailConnection();
    if (!status.connected) return { sent: false, ...status };
    const result = await sendEmail({
      event: 'email_test',
      to: req.admin.email,
      subject: 'SHOPME test email',
      text: 'Good news: your store can send emails. Customers will now get order updates, password resets and more by email.',
    });
    return { sent: Boolean(result.delivered), to: req.admin.email, ...status };
  }),
);

// ----- Payments & refunds (PRD §14.8) -----
router.get('/payments', handle((req) => listPaymentsForAdmin(req.query)));
router.get(
  '/payments/export',
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="shopme-payments-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(await exportPaymentsCsv(req.query));
  }),
);

// ----- Dashboard & reports (PRD §14.1, §14.10) -----
router.get('/dashboard', handle((req) => dashboard(req.query)));
router.get(
  '/reports/:name/export',
  asyncHandler(async (req, res) => {
    const { csv, filename } = await reportCsv(req.params.name, req.query);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }),
);
router.get('/reports/:name', handle((req) => runReport(req.params.name, req.query)));

// ----- Customers (PRD §14.6) -----
router.get('/customers', handle((req) => listCustomersForAdmin(req.query)));
router.get(
  '/customers/export',
  asyncHandler(async (req, res) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="shopme-customers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(await exportCustomersCsv(req.query));
  }),
);
router.get('/customers/:id', handle((req) => getCustomerForAdmin(req.params.id)));
router.post('/customers/:id/block', handle((req) => setCustomerBlocked(req.params.id, req.body || {})));

// ----- Business Settings (PRD §14.11) -----
router.get('/settings', handle(() => getSettingsForAdmin()));
router.put('/settings/:section', handle((req) => saveSettingsSection(req.params.section, req.body || {})));
router.post('/payments/:id/refund', handle((req) => refundPaymentByAdmin(req.params.id, req.body || {})));

export default router;
