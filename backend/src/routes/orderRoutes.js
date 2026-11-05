import { Router } from 'express';
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

// Checkout, payments and My Orders (PRD Phase 4)
const router = Router();
const handle = (fn) => asyncHandler(async (req, res) => res.json(await fn(req, res)));

router.get('/checkout', requireCustomer, handle((req) => getCheckout(req.customer._id)));
router.post('/orders', requireCustomer, handle((req) => placeOrder(req.customer._id, req.body || {})));
router.get('/orders', requireCustomer, handle((req) => listMyOrders(req.customer._id, req.query)));
router.get('/orders/:orderNumber', requireCustomer, handle((req) => getMyOrder(req.customer._id, req.params.orderNumber)));
router.post('/orders/:orderNumber/retry-payment', requireCustomer, handle((req) => retryPayment(req.customer._id, req.params.orderNumber)));
router.post('/payments/verify', requireCustomer, handle((req) => verifyCheckoutPayment(req.customer._id, req.body || {})));
router.post('/payments/failed', requireCustomer, handle((req) => recordPaymentFailure(req.customer._id, req.body || {})));

export default router;

// Razorpay → server backup confirmation. Mounted in app.js with a raw body
// (the signature is checked against the exact bytes Razorpay sent).
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const result = await handleRazorpayWebhook(req.body, req.get('X-Razorpay-Signature'), req.get('X-Razorpay-Event-Id'));
  res.json({ ok: true, ...result });
});
