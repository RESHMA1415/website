import { Order, Payment } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanText, escapeRegex, pageParams, requireObjectId } from '../utils/text.js';
import { refundOnePayment, refundOrder } from './fulfilmentService.js';

// Payments list and refunds for the admin (PRD §14.8). Totals and CSV export
// are completed with the reports in Phase 8.

const STATUSES = ['paid', 'failed', 'pending', 'refund_initiated', 'refunded', 'partially_refunded', 'cod_pending', 'cod_collected', 'cancelled'];

export async function listPaymentsForAdmin(query = {}) {
  const filter = {};
  if (STATUSES.includes(query.status)) filter.status = query.status;
  if (['razorpay', 'cod'].includes(query.provider)) filter.provider = query.provider;
  const q = cleanText(query.q, 60);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const orders = await Order.find({ $or: [{ orderNumber: pattern }, { 'address.fullName': pattern }, { 'address.mobile': pattern }] }, { _id: 1 }).limit(200).lean();
    filter.$or = [{ order: { $in: orders.map((o) => o._id) } }, { razorpayPaymentId: pattern }, { razorpayOrderId: pattern }];
  }
  const { page, limit, skip } = pageParams(query, { defaultLimit: 25, maxLimit: 100 });
  const [rows, total, sums] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber address.fullName address.mobile').lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      {
        $group: {
          _id: null,
          online: { $sum: { $cond: [{ $and: [{ $eq: ['$provider', 'razorpay'] }, { $in: ['$status', ['paid', 'partially_refunded', 'refunded', 'refund_initiated']] }] }, '$amount', 0] } },
          codCollected: { $sum: { $cond: [{ $and: [{ $eq: ['$provider', 'cod'] }, { $in: ['$status', ['cod_collected', 'partially_refunded', 'refunded']] }] }, '$amount', 0] } },
          codPending: { $sum: { $cond: [{ $eq: ['$status', 'cod_pending'] }, '$amount', 0] } },
          refunds: { $sum: { $ifNull: ['$refundedAmount', 0] } },
          needsRefund: { $sum: { $cond: [{ $eq: ['$status', 'refund_initiated'] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const t = sums[0] || {};
  return {
    items: rows.map((p) => ({
      id: p._id,
      createdAt: p.createdAt,
      orderNumber: p.order?.orderNumber,
      customer: p.order?.address?.fullName,
      amount: p.amount,
      provider: p.provider,
      method: p.method,
      razorpayPaymentId: p.razorpayPaymentId,
      status: p.status,
      refundedAmount: p.refundedAmount || 0,
      failureReason: p.failureReason,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    totals: { online: t.online || 0, codCollected: t.codCollected || 0, codPending: t.codPending || 0, refunds: t.refunds || 0, needsRefund: t.needsRefund || 0 },
  };
}

// Refund from the Payments list goes through the order, so its totals stay right
export async function refundPaymentByAdmin(id, body = {}) {
  const payment = await Payment.findById(requireObjectId(id, 'We couldn’t find that payment.')).lean();
  if (!payment) throw new HttpError(404, 'We couldn’t find that payment.');
  const order = await Order.findById(payment.order);
  const amount = Math.round(Number(body.amount));
  const options = { amount, reason: cleanText(body.reason, 200) || 'Refund', manualReference: cleanText(body.manualReference, 80) };
  // A second (duplicate) payment on an order is money the order never used:
  // refund it on its own, without touching the order's totals
  const duplicate = await Payment.exists({ _id: { $ne: payment._id }, order: payment.order, provider: payment.provider, createdAt: { $lt: payment.createdAt }, status: { $in: ['paid', 'partially_refunded', 'refunded'] } });
  const result = duplicate ? await refundOnePayment(payment, options) : await refundOrder(order, options);
  return { amount: result.amount, status: result.status, reference: result.reference };
}
