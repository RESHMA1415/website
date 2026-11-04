import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    variantLabel: String, // e.g. "M, Blue"
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 80 },
    text: { type: String, required: true, minlength: 10, maxlength: 1000 },
    photos: {
      type: [String],
      validate: { validator: (photos) => photos.length <= 5, message: 'Maximum 5 photos' },
    },
    videoUrl: String,
    fitFeedback: { type: String, enum: ['runs_small', 'true_to_size', 'runs_large', ''] },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'hidden'], default: 'pending' },
    rejectionReason: String,
    adminReply: { text: String, at: Date },
    helpfulVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: Date,
  },
  { timestamps: true },
);

// One review per product per order (PRD §11.1)
reviewSchema.index({ product: 1, order: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
