import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
  removeStored,
  storeImage,
  storeVideo,
} from '../integrations/media.js';
import { Banner, Category, Media, Product, Setting, SizeChart } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanText, escapeRegex, pageParams, requireObjectId } from '../utils/text.js';

const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

// Saves each uploaded file; one bad file never stops the others
export async function uploadMedia(files = []) {
  if (!files.length) throw new HttpError(400, 'Please choose at least one photo or video.');
  const saved = [];
  const errors = [];
  for (const file of files) {
    const name = cleanText(file.originalname, 150) || 'file';
    try {
      let stored;
      if (IMAGE_TYPES.includes(file.mimetype)) {
        if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, `is larger than ${mb(MAX_IMAGE_BYTES)}`);
        stored = { kind: 'image', ...(await storeImage(file.buffer)) };
      } else if (VIDEO_TYPES.includes(file.mimetype)) {
        if (file.size > MAX_VIDEO_BYTES) throw new HttpError(400, `is larger than ${mb(MAX_VIDEO_BYTES)}`);
        stored = { kind: 'video', ...(await storeVideo(file.buffer)) };
      } else {
        throw new HttpError(400, 'is not a JPG, PNG, WebP photo or MP4 video');
      }
      saved.push((await Media.create({ ...stored, originalName: name })).toObject());
    } catch (err) {
      if (!(err instanceof HttpError)) console.error('Upload failed', err);
      const reason = err instanceof HttpError ? err.message : 'could not be saved';
      errors.push(/^[a-z]/.test(reason) ? `${name} ${reason}.` : `${name}: ${reason}`);
    }
  }
  return { saved, errors };
}

export async function listMedia(query) {
  const { page, limit, skip } = pageParams(query, { defaultLimit: 40, maxLimit: 100 });
  const filter = {};
  if (query.kind === 'image' || query.kind === 'video') filter.kind = query.kind;
  const q = cleanText(query.q, 100);
  if (q) filter.originalName = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Media.find(filter, { storage: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Media.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

// Where a file is used, so it is never deleted from under a live product.
// Pages may point at any of a photo's sizes (large, medium or thumb).
async function usageOf(media) {
  const urls = { $in: [media.url, media.mediumUrl, media.thumbUrl].filter(Boolean) };
  const [products, banners, categories, sizeCharts, settings] = await Promise.all([
    Product.find(
      { $or: [{ 'images.url': urls }, { 'images.mediumUrl': urls }, { 'images.thumbUrl': urls }, { videoUrl: urls }] },
      { name: 1 },
    ).limit(5).lean(),
    Banner.find({ $or: [{ desktopImageUrl: urls }, { mobileImageUrl: urls }] }, { heading: 1 }).limit(5).lean(),
    Category.find({ $or: [{ imageUrl: urls }, { bannerUrl: urls }] }, { name: 1 }).limit(5).lean(),
    SizeChart.find({ imageUrl: urls }, { name: 1 }).limit(5).lean(),
    Setting.exists({ $or: [{ 'values.store.logoUrl': urls }, { 'values.store.faviconUrl': urls }, { 'values.seo.shareImageUrl': urls }] }),
  ]);
  return [
    ...products.map((p) => `product “${p.name}”`),
    ...banners.map((b) => `banner “${b.heading}”`),
    ...categories.map((c) => `category “${c.name}”`),
    ...sizeCharts.map((s) => `size chart “${s.name}”`),
    ...(settings ? ['Business Settings'] : []),
  ];
}

export async function deleteMedia(id) {
  const media = await Media.findById(requireObjectId(id, 'We couldn’t find that file.'));
  if (!media) throw new HttpError(404, 'We couldn’t find that file.');
  const usedBy = await usageOf(media);
  if (usedBy.length) {
    throw new HttpError(409, `This file is still used by ${usedBy.join(', ')}. Remove it there first.`);
  }
  await removeStored(media.storage);
  await media.deleteOne();
}
