import { Router } from 'express';
import multer from 'multer';
import { cancelMyOrder, trackOrder } from '../services/fulfilmentService.js';
import { createReturnRequest, getReturnOptions, uploadReturnPhotos } from '../services/returnService.js';
import { getReviewForm, listMyReviews, markHelpful, submitReview, uploadReviewMedia } from '../services/reviewService.js';
import { MAX_VIDEO_BYTES } from '../integrations/media.js';
import { requireCustomer } from '../middleware/requireCustomer.js';
import {
  getCheckout,
  getMyOrder,
  handleRazorpayWebhook,
  listMyOrders,
  placeOrder,
  recordPaymentFailure,
  retryPayment,
  verifyCheckoutPayment,
} from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Checkout, payments, My Orders, cancellations, returns and tracking (PRD Phases 4–5)
const router = Router();
const reviewUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES, files: 6 } });
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 5 } });
const handle = (fn) => asyncHandler(async (req, res) => res.json(await fn(req, res)));

router.get('/checkout', requireCustomer, handle((req) => getCheckout(req.customer._id)));
router.post('/orders', requireCustomer, handle((req) => placeOrder(req.customer._id, req.body || {})));
router.get('/orders', requireCustomer, handle((req) => listMyOrders(req.customer._id, req.query)));
router.get('/orders/:orderNumber', requireCustomer, handle((req) => getMyOrder(req.customer._id, req.params.orderNumber)));
router.post('/orders/:orderNumber/retry-payment', requireCustomer, handle((req) => retryPayment(req.customer._id, req.params.orderNumber)));
router.post('/orders/:orderNumber/cancel', requireCustomer, handle((req) => cancelMyOrder(req.customer._id, req.params.orderNumber, req.body || {})));
router.get('/orders/:orderNumber/return-options', requireCustomer, handle((req) => getReturnOptions(req.customer._id, req.params.orderNumber)));
router.post('/orders/:orderNumber/returns', requireCustomer, handle((req) => createReturnRequest(req.customer._id, req.params.orderNumber, req.body || {})));
router.post('/returns/photos', requireCustomer, photoUpload.array('photos', 5), handle((req) => uploadReturnPhotos(req.files)));
// Verified-buyer reviews (PRD §11)
router.get('/orders/:orderNumber/review/:productId', requireCustomer, handle((req) => getReviewForm(req.customer._id, req.params.orderNumber, req.params.productId)));
router.post('/orders/:orderNumber/review/:productId', requireCustomer, handle((req) => submitReview(req.customer._id, req.params.orderNumber, req.params.productId, req.body || {})));
router.post('/reviews/media', requireCustomer, reviewUpload.array('files', 6), handle((req) => uploadReviewMedia(req.files)));
router.get('/reviews/mine', requireCustomer, handle((req) => listMyReviews(req.customer._id)));
router.post('/reviews/:id/helpful', requireCustomer, handle((req) => markHelpful(req.customer._id, req.params.id)));
// Public tracking with order number + mobile/email (no login)
router.post('/track', handle((req) => trackOrder(req.body || {}, { ip: req.ip })));
router.post('/payments/verify', requireCustomer, handle((req) => verifyCheckoutPayment(req.customer._id, req.body || {})));
router.post('/payments/failed', requireCustomer, handle((req) => recordPaymentFailure(req.customer._id, req.body || {})));

export default router;

// Razorpay → server backup confirmation. Mounted in app.js with a raw body
// (the signature is checked against the exact bytes Razorpay sent).
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const result = await handleRazorpayWebhook(req.body, req.get('X-Razorpay-Signature'), req.get('X-Razorpay-Event-Id'));
  res.json({ ok: true, ...result });
});
