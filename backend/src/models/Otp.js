import mongoose from 'mongoose';

// One-time passwords for login and registration. Only a hash of the code is
// stored; MongoDB removes each record an hour after it expires.
const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true },
    purpose: { type: String, enum: ['login', 'register'], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

otpSchema.index({ mobile: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model('Otp', otpSchema);
