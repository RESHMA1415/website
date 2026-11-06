import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  alternateMobile: { type: String, match: /^[6-9]\d{9}$/ },
  pincode: { type: String, required: true, match: /^[1-9]\d{5}$/ },
  house: { type: String, required: true, trim: true },
  street: { type: String, required: true, trim: true },
  landmark: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  type: { type: String, enum: ['home', 'work'], default: 'home' },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    // Set when the customer proved they own the number with an SMS OTP
    mobileVerifiedAt: Date,
    passwordHash: { type: String, required: true, select: false },
    // Logins issued before this time stop working (password change or reset)
    passwordChangedAt: { type: Date, default: Date.now },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dateOfBirth: Date,
    addresses: [addressSchema],
    wishlist: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        priceWhenAdded: Number,
        addedAt: { type: Date, default: Date.now },
      },
    ],
    // DPDP Act: proof of what the customer agreed to, and when
    consent: {
      termsAndPrivacyAcceptedAt: Date,
      policyVersion: String,
    },
    isBlocked: { type: Boolean, default: false },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetRequestedAt: { type: Date, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

export default mongoose.model('User', userSchema);
