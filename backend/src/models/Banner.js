import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    desktopImageUrl: String,
    mobileImageUrl: String,
    heading: { type: String, required: true },
    subHeading: String,
    buttonText: String,
    buttonLink: String,
    displayOrder: { type: Number, default: 0 },
    activeFrom: Date,
    activeTo: Date,
    status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.model('Banner', bannerSchema);
