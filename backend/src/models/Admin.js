import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    // Logins issued before this time stop working (e.g. after a password change)
    passwordChangedAt: { type: Date, default: Date.now },
    twoStepEnabled: { type: Boolean, default: false },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model('Admin', adminSchema);
