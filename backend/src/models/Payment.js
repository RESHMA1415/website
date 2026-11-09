import mongoose from 'mongoose';
import { PAYMENT_STATUSES } from './Order.js';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    provider: { type: String, enum: ['razorpay', 'cod'], required: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'wallet', 'cod', 'other'] },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    failureReason: String,
    refundedAmount: { type: Number, default: 0 },
    refunds: [
      {
        amount: { type: Number, required: true },
        // 'processing' while Razorpay is being asked; removed again if it fails
        state: { type: String, enum: ['processing', 'done'], default: 'done' },
        by: { type: String, enum: ['system', 'admin'], default: 'admin' },
        razorpayRefundId: String,
        manualReference: String, // UPI/bank reference for COD refunds
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],
    // Razorpay webhook event ids already handled, so retries are processed once
    processedEventIds: [String],
  },
  { timestamps: true },
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
