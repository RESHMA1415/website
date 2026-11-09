import mongoose from 'mongoose';

export const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'return_requested',
  'return_approved',
  'return_rejected',
  'returned',
  'refunded',
  'exchanged',
  'delivery_failed',
];

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refund_initiated',
  'refunded',
  'partially_refunded',
  'cod_pending',
  'cod_collected',
  'cancelled', // COD order cancelled or not delivered: nothing to collect
];

// Snapshot of what was bought, frozen at purchase time (PRD §15)
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  imageUrl: String,
  options: { size: String, colour: String, shade: String, volume: String },
  sku: { type: String, required: true },
  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  isReturnable: Boolean,
  reviewed: { type: Boolean, default: false },
  // Units already in an open or finished return/exchange request (never more than quantity)
  returnRequestedQty: { type: Number, default: 0 },
});

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    mobile: String,
    alternateMobile: String,
    pincode: String,
    house: String,
    street: String,
    landmark: String,
    city: String,
    state: String,
    type: String,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], validate: (items) => items.length > 0 },
    address: { type: addressSnapshotSchema, required: true },
    subtotal: { type: Number, required: true },
    deliveryCharge: { type: Number, required: true, default: 0 },
    codCharge: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    savings: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['online', 'cod'], required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending_payment' },
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        note: String,
        by: { type: String, enum: ['system', 'customer', 'admin'] },
        at: { type: Date, default: Date.now },
      },
    ],
    shipping: {
      courier: String,
      trackingNumber: String,
      trackingUrl: String,
      shippedAt: Date,
      deliveredAt: Date,
    },
    cancellation: { reason: String, by: String, at: Date },
    // Courier could not deliver: when the parcel came back and was restocked
    rto: { restockedAt: Date, restocked: Boolean },
    // A wrong/damaged item refund includes the delivery charge once per order
    deliveryRefundClaimed: { type: Boolean, default: false },
    internalNotes: [{ text: String, at: { type: Date, default: Date.now } }],
    refundedAmount: { type: Number, default: 0 },
    reviewReminderSent: { type: Boolean, default: false },
    // "Payment failed, retry" email goes out once per order (PRD §12.2)
    paymentFailedEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'address.mobile': 1 });

export default mongoose.model('Order', orderSchema);
