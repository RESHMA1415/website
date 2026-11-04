import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // Product type decides which variant options products in this category use (PRD §5.2)
    productType: { type: String, enum: ['clothing', 'fashion', 'beauty', 'accessories'] },
    gender: { type: String, enum: ['men', 'women', 'unisex'] },
    imageUrl: String,
    bannerUrl: String,
    description: String,
    displayOrder: { type: Number, default: 0 },
    showInMenu: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  },
  { timestamps: true },
);

categorySchema.index({ parent: 1, displayOrder: 1 });

export default mongoose.model('Category', categorySchema);
