import mongoose from 'mongoose';

// One sellable combination, e.g. "Blue / M" or "Ruby Red / 4 g" (PRD §5.2)
const variantSchema = new mongoose.Schema({
  options: {
    size: String,
    colour: String,
    colourHex: String,
    shade: String,
    volume: String,
  },
  sku: { type: String, required: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockLevel: { type: Number, min: 0, default: 5 },
  price: { type: Number, min: 0 }, // overrides product selling price when set
  mrp: { type: Number, min: 0 },
});

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    mediumUrl: String,
    thumbUrl: String,
    alt: String,
    colour: String, // photos shown when this colour is selected
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    productType: {
      type: String,
      enum: ['clothing', 'fashion', 'beauty', 'accessories'],
      required: true,
    },
    gender: { type: String, enum: ['men', 'women', 'unisex'] },
    brand: { type: String, trim: true },
    shortDescription: { type: String, required: true, maxlength: 300 },
    description: { type: String, required: true },
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(value) {
          // On update queries `this` is the query, so read MRP from the update
          if (this instanceof mongoose.Query) {
            const update = this.getUpdate() || {};
            const mrp = update.$set?.mrp ?? update.mrp;
            return mrp === undefined || value <= mrp;
          }
          return value <= this.mrp;
        },
        message: 'Selling price cannot be more than MRP',
      },
    },
    attributes: {
      fabric: String,
      fit: { type: String, enum: ['slim', 'regular', 'relaxed', 'oversized', ''] },
      pattern: String,
      sleeve: String,
      neck: String,
      occasion: String,
      care: String,
      ingredients: String,
      howToUse: String,
      skinType: String,
      shelfLife: String,
    },
    sizeChart: { type: mongoose.Schema.Types.ObjectId, ref: 'SizeChart' },
    images: [mediaSchema],
    videoUrl: String,
    variants: [variantSchema],
    tags: [{ type: String, lowercase: true, trim: true }],
    isReturnable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'active', 'hidden'], default: 'draft' },
    seo: { title: String, description: String },
    // Kept up to date by the review and order services
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
    unitsSold: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ status: 1, category: 1, subCategory: 1 });
productSchema.index({ status: 1, createdAt: -1 });
// Unique across products: stops two parallel saves from creating the same SKU
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index({ name: 'text', tags: 'text', brand: 'text', shortDescription: 'text' });

export default mongoose.model('Product', productSchema);
