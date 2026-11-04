import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sku: String,
    change: { type: Number, required: true },
    stockAfter: Number,
    reason: {
      type: String,
      enum: ['order', 'cancellation', 'return', 'exchange', 'rto', 'new_stock', 'damaged', 'correction'],
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    note: String,
  },
  { timestamps: true },
);

stockMovementSchema.index({ product: 1, variantId: 1, createdAt: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);
