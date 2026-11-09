import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobile: String,
    orderNumber: String,
    subject: {
      type: String,
      enum: ['order_issue', 'return', 'product_question', 'other'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['new', 'replied', 'closed'], default: 'new' },
    // Account that sent it (if logged in), the consent ticked on the form, and owner notes
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    consent: { acceptedAt: Date, policyVersion: String },
    adminNote: { type: String, maxlength: 1000 },
    repliedAt: Date,
  },
  { timestamps: true },
);

contactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ContactMessage', contactMessageSchema);
