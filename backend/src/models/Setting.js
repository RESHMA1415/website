import mongoose from 'mongoose';

// Single document holding all Business Settings (PRD §14.11).
// Stored as a flexible object so new settings never need a schema migration.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'business', unique: true },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    pages: {
      about: { type: String, default: '' },
      privacy: { type: String, default: '' },
      terms: { type: String, default: '' },
      shipping: { type: String, default: '' },
      returns: { type: String, default: '' },
      cancellation: { type: String, default: '' },
      faq: { type: String, default: '' },
    },
    // Razorpay secrets live in .env, never here
  },
  { timestamps: true, minimize: false },
);

export default mongoose.model('Setting', settingSchema);
