import mongoose from 'mongoose';

// One uploaded photo or video in the Media Library (PRD §14.4). Photos are
// stored in three sizes; `url` is the large version.
const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['image', 'video'], required: true },
    originalName: { type: String, trim: true },
    url: { type: String, required: true },
    mediumUrl: String,
    thumbUrl: String,
    width: Number,
    height: Number,
    bytes: Number,
    // Storage location details so the file can be deleted later
    storage: { driver: String, keys: [String] },
  },
  { timestamps: true },
);

mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ originalName: 'text' });

export default mongoose.model('Media', mediaSchema);
