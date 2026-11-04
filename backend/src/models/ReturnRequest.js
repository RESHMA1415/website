import mongoose from 'mongoose';

export const RETURN_REASONS = [
  'size_doesnt_fit',
  'damaged',
  'wrong_item',
  'quality_not_expected',
  'colour_different',
  'other',
];

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'pickup_scheduled',
  'received',
  'refunded',
  'replacement_shipped',
  'closed',
];

const returnRequestSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['return', 'exchange'], required: true },
    items: [
      {
        orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        quantity: { type: Number, required: true, min: 1 },
        exchangeVariantId: mongoose.Schema.Types.ObjectId,
      },
    ],
    reason: { type: String, enum: RETURN_REASONS, required: true },
    comments: String,
    photos: [String],
    refundDetails: {
      upiId: String,
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
    },
    pickupAddress: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: RETURN_STATUSES, default: 'requested' },
    statusHistory: [
      { status: String, note: String, at: { type: Date, default: Date.now } },
    ],
    rejectionReason: String,
    reversePickupTracking: String,
    restock: Boolean,
    refundAmount: Number,
    replacementTracking: { courier: String, trackingNumber: String, trackingUrl: String },
  },
  { timestamps: true },
);

export default mongoose.model('ReturnRequest', returnRequestSchema);
