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
  },
  { timestamps: true },
);

export default mongoose.model('ContactMessage', contactMessageSchema);
