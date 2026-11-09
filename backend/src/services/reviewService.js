import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { sendEmail } from '../integrations/email.js';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES, storeImage, storeVideo } from '../integrations/media.js';
import { Order, Product, Review, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanMediaUrl, cleanText, escapeRegex, pageParams, requireObjectId } from '../utils/text.js';
import { optionText } from './orderNotifications.js';
import { getSettings } from './settingsService.js';

// Verified-buyer reviews (PRD §11). Only approved reviews are public and count
// towards a product's rating; every new or edited review waits for the admin.

export const REVIEW_RULES = {
  titleMax: 80,
  textMin: 10,
  textMax: 1000,
  photosMax: 5,
  editDays: 30,
  reminderDays: 3, // reminder email this many days after delivery (PRD §11.5)
};
const FIT = ['runs_small', 'true_to_size', 'runs_large'];
const FIT_LABEL = { runs_small: 'Runs small', true_to_size: 'True to size', runs_large: 'Runs large' };
const DELIVERED = { 'statusHistory.status': 'delivered' };

// "Priya Sharma" → "Priya S."
export function publicName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SHOPME customer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

const editableUntil = (review) => new Date(new Date(review.createdAt).getTime() + REVIEW_RULES.editDays * 86400000);

// ---------- Ratings on the product (approved reviews only, PRD §6.8) ----------
export async function recomputeRatings(productId) {
  const id = new mongoose.Types.ObjectId(String(productId));
  const rows = await Review.aggregate([{ $match: { product: id, status: 'approved' } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]);
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    breakdown[r._id] = r.n;
    count += r.n;
    sum += r._id * r.n;
  }
  const average = count ? Math.round((sum / count) * 10) / 10 : 0;
  await Product.updateOne({ _id: id }, { ratingAverage: average, ratingCount: count, ratingBreakdown: breakdown });
  return { average, count, breakdown };
}

// ---------- Customer: what can be reviewed ----------
async function deliveredOrder(userId, orderNumber) {
  const order = await Order.findOne({ orderNumber: cleanText(orderNumber, 30), user: userId }).lean();
  if (!order) throw new HttpError(404, 'We couldn’t find that order.');
  if (!order.statusHistory.some((h) => h.status === 'delivered')) throw new HttpError(409, 'You can review a product once your order is delivered.');
  return order;
}

function boughtLines(order, productId) {
  const lines = order.items.filter((i) => String(i.product) === String(productId));
  if (!lines.length) throw new HttpError(404, 'This product isn’t in that order.');
  return lines;
}

function myReviewView(review) {
  return {
    id: review._id,
    rating: review.rating,
    title: review.title,
    text: review.text,
    photos: review.photos || [],
    videoUrl: review.videoUrl,
    fitFeedback: review.fitFeedback || '',
    status: review.status,
    adminReply: review.adminReply?.text ? review.adminReply : undefined,
    createdAt: review.createdAt,
    editedAt: review.editedAt,
    canEdit: editableUntil(review) > new Date(),
    editableUntil: editableUntil(review),
  };
}

export async function getReviewForm(userId, orderNumber, productId) {
  const order = await deliveredOrder(userId, orderNumber);
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const lines = boughtLines(order, pid);
  const [product, review] = await Promise.all([
    Product.findById(pid, { name: 1, slug: 1, productType: 1 }).lean(),
    Review.findOne({ product: pid, order: order._id, user: userId }).lean(),
  ]);
  return {
    orderNumber: order.orderNumber,
    productId: pid,
    name: lines[0].name,
    slug: product?.slug,
    imageUrl: lines[0].imageUrl,
    variantLabel: lines.map((l) => optionText(l.options)).filter(Boolean).join(' · '),
    askFit: product?.productType === 'clothing',
    rules: REVIEW_RULES,
    review: review ? myReviewView(review) : null,
  };
}

function cleanReview(body, { askFit }) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Please choose a star rating from 1 to 5.');
  const title = cleanText(body.title, 200);
  if (title.length > REVIEW_RULES.titleMax) throw new HttpError(400, `Please keep the title to ${REVIEW_RULES.titleMax} characters.`);
  const text = cleanText(body.text, 2000);
  if (text.length < REVIEW_RULES.textMin) throw new HttpError(400, `Please write at least ${REVIEW_RULES.textMin} characters about the product.`);
  if (text.length > REVIEW_RULES.textMax) throw new HttpError(400, `Please keep your review to ${REVIEW_RULES.textMax} characters.`);
  const photos = (Array.isArray(body.photos) ? body.photos : []).map((p) => cleanMediaUrl(p)).filter(Boolean);
  if (photos.length > REVIEW_RULES.photosMax) throw new HttpError(400, `Please add at most ${REVIEW_RULES.photosMax} photos.`);
  const videoUrl = body.videoUrl ? cleanMediaUrl(body.videoUrl) : '';
  const fitFeedback = askFit && FIT.includes(body.fitFeedback) ? body.fitFeedback : '';
  return { rating, title, text, photos, videoUrl, fitFeedback };
}

async function alertAdminNewReview(review, productName, edited) {
  try {
    const settings = await getSettings();
    if (!settings.notifications?.adminAlertEmail) return;
    await sendEmail({
      event: 'review_submitted_admin',
      to: settings.notifications.adminAlertEmail,
      subject: `${edited ? 'Edited' : 'New'} review to approve: ${productName} (${review.rating}★)`,
      text: `${review.authorName} ${edited ? 'edited their' : 'wrote a'} ${review.rating}-star review of ${productName}:\n\n${review.title ? `${review.title}\n` : ''}${review.text}\n\nOpen Reviews in the admin panel to approve or reject it.`,
    });
  } catch (err) {
    console.error('Review alert failed', err);
  }
}

export async function submitReview(userId, orderNumber, productId, body = {}) {
  const form = await getReviewForm(userId, orderNumber, productId);
  const data = cleanReview(body, form);
  const order = await Order.findOne({ orderNumber: form.orderNumber, user: userId }, { _id: 1 }).lean();
  const existing = await Review.findOne({ product: form.productId, order: order._id, user: userId });

  if (existing) {
    if (editableUntil(existing) < new Date()) throw new HttpError(409, `Reviews can be edited for ${REVIEW_RULES.editDays} days after you post them.`);
    const wasApproved = existing.status === 'approved';
    // Edits go back for approval (PRD §11.1)
    Object.assign(existing, data, { status: 'pending', editedAt: new Date(), rejectionReason: undefined });
    await existing.save();
    if (wasApproved) await recomputeRatings(form.productId);
    alertAdminNewReview(existing, form.name, true);
    return myReviewView(existing.toObject());
  }

  const user = await User.findById(userId, { name: 1 }).lean();
  let review;
  try {
    review = await Review.create({ ...data, product: form.productId, user: userId, order: order._id, variantLabel: form.variantLabel, authorName: publicName(user?.name) });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'You’ve already reviewed this product for this order. You can edit that review instead.');
    throw err;
  }
  await Order.updateOne({ _id: order._id }, { $set: { 'items.$[i].reviewed': true } }, { arrayFilters: [{ 'i.product': review.product }] });
  alertAdminNewReview(review, form.name, false);
  return myReviewView(review.toObject());
}

// Review photos and one video (PRD §11.2)
export async function uploadReviewMedia(files = []) {
  if (!files.length) throw new HttpError(400, 'Please choose a photo or video.');
  const photos = [];
  let videoUrl = '';
  for (const file of files) {
    if (IMAGE_TYPES.includes(file.mimetype)) {
      if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Each photo must be 5 MB or smaller.');
      const stored = await storeImage(file.buffer);
      photos.push(stored.mediumUrl || stored.url);
    } else if (VIDEO_TYPES.includes(file.mimetype)) {
      if (videoUrl) throw new HttpError(400, 'Please add only one video.');
      if (file.size > MAX_VIDEO_BYTES) throw new HttpError(400, 'The video must be 50 MB or smaller.');
      videoUrl = (await storeVideo(file.buffer)).url;
    } else {
      throw new HttpError(400, 'Please upload JPG, PNG or WebP photos, or an MP4/MOV video.');
    }
  }
  if (photos.length > REVIEW_RULES.photosMax) throw new HttpError(400, `Please add at most ${REVIEW_RULES.photosMax} photos.`);
  return { photos, videoUrl };
}

// My Reviews: written reviews plus delivered products still waiting for one
export async function listMyReviews(userId) {
  const [reviews, orders] = await Promise.all([
    Review.find({ user: userId }).sort({ createdAt: -1 }).limit(100).populate('product', 'name slug images').populate('order', 'orderNumber').lean(),
    Order.find({ user: userId, ...DELIVERED }, { orderNumber: 1, items: 1, 'shipping.deliveredAt': 1 }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  const done = new Set(reviews.map((r) => `${r.order?._id}:${r.product?._id}`));
  const toReview = [];
  for (const o of orders) {
    const seen = new Set();
    for (const i of o.items) {
      const key = `${o._id}:${i.product}`;
      if (done.has(key) || seen.has(key)) continue;
      seen.add(key);
      toReview.push({ orderNumber: o.orderNumber, productId: i.product, name: i.name, imageUrl: i.imageUrl, deliveredAt: o.shipping?.deliveredAt });
    }
  }
  return {
    reviews: reviews.map((r) => ({
      ...myReviewView(r),
      productId: r.product?._id,
      productName: r.product?.name || 'Product no longer available',
      productSlug: r.product?.slug,
      imageUrl: r.product?.images?.[0]?.thumbUrl || r.product?.images?.[0]?.url,
      orderNumber: r.order?.orderNumber,
    })),
    toReview: toReview.slice(0, 20),
  };
}

// ---------- Product page (PRD §11.4) ----------
const SORTS = {
  recent: { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
  media: { createdAt: -1 },
};

function publicReview(r, viewerId) {
  return {
    id: r._id,
    author: r.authorName || 'SHOPME customer',
    rating: r.rating,
    title: r.title,
    text: r.text,
    date: r.createdAt,
    edited: Boolean(r.editedAt),
    variantLabel: r.variantLabel,
    fit: FIT_LABEL[r.fitFeedback],
    photos: r.photos || [],
    videoUrl: r.videoUrl || undefined,
    reply: r.adminReply?.text ? { text: r.adminReply.text, at: r.adminReply.at } : undefined,
    helpful: r.helpfulVoters?.length || 0,
    votedHelpful: viewerId ? (r.helpfulVoters || []).some((v) => String(v) === String(viewerId)) : false,
    mine: viewerId ? String(r.user) === String(viewerId) : false,
  };
}

export async function listProductReviews(slug, query = {}, viewerId) {
  const product = await Product.findOne({ slug: cleanText(slug, 200), status: 'active' }, { _id: 1, ratingAverage: 1, ratingCount: 1, ratingBreakdown: 1 }).lean();
  if (!product) throw new HttpError(404, 'We couldn’t find that product.');
  const sort = SORTS[query.sort] ? query.sort : 'recent';
  const filter = { product: product._id, status: 'approved' };
  const stars = Number(query.rating);
  if ([1, 2, 3, 4, 5].includes(stars)) filter.rating = stars;
  if (sort === 'media') filter.$or = [{ 'photos.0': { $exists: true } }, { videoUrl: { $nin: [null, ''] } }];
  const { page, limit, skip } = pageParams(query, { defaultLimit: 10, maxLimit: 30 });
  const [rows, total, media] = await Promise.all([
    Review.find(filter).sort(SORTS[sort]).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
    page === 1
      ? Review.find({ product: product._id, status: 'approved', $or: [{ 'photos.0': { $exists: true } }, { videoUrl: { $nin: [null, ''] } }] }, { photos: 1, videoUrl: 1, authorName: 1, rating: 1 })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean()
      : [],
  ]);
  const gallery = [];
  for (const r of media) {
    if (r.videoUrl) gallery.push({ type: 'video', url: r.videoUrl, reviewId: r._id, author: r.authorName, rating: r.rating });
    for (const url of r.photos || []) gallery.push({ type: 'photo', url, reviewId: r._id, author: r.authorName, rating: r.rating });
  }
  return {
    summary: { average: product.ratingAverage || 0, count: product.ratingCount || 0, breakdown: product.ratingBreakdown || {} },
    items: rows.map((r) => publicReview(r, viewerId)),
    gallery: gallery.slice(0, 24),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

// "Helpful" (one vote per customer, PRD §11.4)
export async function markHelpful(userId, reviewId) {
  const id = requireObjectId(reviewId, 'We couldn’t find that review.');
  const review = await Review.findOne({ _id: id, status: 'approved' }, { user: 1 }).lean();
  if (!review) throw new HttpError(404, 'We couldn’t find that review.');
  if (String(review.user) === String(userId)) throw new HttpError(400, 'You can’t vote on your own review.');
  const updated = await Review.findOneAndUpdate({ _id: id }, { $addToSet: { helpfulVoters: userId } }, { new: true, projection: { helpfulVoters: 1 } }).lean();
  return { helpful: updated.helpfulVoters.length, votedHelpful: true };
}

// ---------- Admin (PRD §11.3, §14.9) ----------
const TABS = ['pending', 'approved', 'rejected', 'hidden'];

export async function listReviewsForAdmin(query = {}) {
  const tab = TABS.includes(query.tab) ? query.tab : 'pending';
  const filter = { status: tab };
  const stars = Number(query.rating);
  if ([1, 2, 3, 4, 5].includes(stars)) filter.rating = stars;
  const q = cleanText(query.q, 80);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const products = await Product.find({ name: pattern }, { _id: 1 }).limit(200).lean();
    filter.$or = [{ product: { $in: products.map((p) => p._id) } }, { authorName: pattern }, { text: pattern }, { title: pattern }];
  }
  const { page, limit, skip } = pageParams(query, { defaultLimit: 20, maxLimit: 100 });
  const [rows, total, byStatus] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: tab === 'pending' ? 1 : -1 }) // oldest waiting first
      .skip(skip)
      .limit(limit)
      .populate('product', 'name slug images')
      .populate('user', 'name email')
      .populate('order', 'orderNumber')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const counts = Object.fromEntries(TABS.map((t) => [t, byStatus.find((s) => s._id === t)?.n || 0]));
  return {
    items: rows.map((r) => ({
      id: r._id,
      status: r.status,
      rating: r.rating,
      title: r.title,
      text: r.text,
      photos: r.photos || [],
      videoUrl: r.videoUrl,
      fit: FIT_LABEL[r.fitFeedback],
      variantLabel: r.variantLabel,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      rejectionReason: r.rejectionReason,
      reply: r.adminReply?.text ? r.adminReply : undefined,
      helpful: r.helpfulVoters?.length || 0,
      author: r.authorName,
      customer: r.user ? { name: r.user.name, email: r.user.email } : null,
      orderNumber: r.order?.orderNumber,
      product: r.product ? { id: r.product._id, name: r.product.name, slug: r.product.slug, imageUrl: r.product.images?.[0]?.thumbUrl || r.product.images?.[0]?.url } : null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
    counts,
  };
}

export async function pendingReviewCount() {
  return { pending: await Review.countDocuments({ status: 'pending' }) };
}

async function tellCustomer(review, event, subject, body) {
  try {
    const [user, product] = await Promise.all([User.findById(review.user, { name: 1, email: 1 }).lean(), Product.findById(review.product, { name: 1, slug: 1 }).lean()]);
    if (!user?.email) return;
    const settings = await getSettings();
    await sendEmail({
      event,
      to: user.email,
      subject: subject(product?.name || 'your product'),
      text: `Hi ${user.name},\n\n${body(product?.name || 'your product')}\n\n${product?.slug ? `See it here: ${env.storeUrl}/product/${product.slug}#reviews\n\n` : ''}Thank you for shopping with ${settings.store.name}!`,
    });
  } catch (err) {
    console.error('Review email failed', err);
  }
}

// Moves a review between states (compare-and-set on the current state)
async function setStatus(id, from, update) {
  const review = await Review.findOneAndUpdate({ _id: requireObjectId(id, 'We couldn’t find that review.'), status: { $in: from } }, update, { new: true });
  if (!review) {
    const exists = await Review.exists({ _id: id });
    throw new HttpError(exists ? 409 : 404, exists ? 'This review was changed in the meantime. Please reload the page.' : 'We couldn’t find that review.');
  }
  await recomputeRatings(review.product);
  return review;
}

export async function reviewAction(id, action, body = {}) {
  let review;
  switch (action) {
    case 'approve':
      review = await setStatus(id, ['pending', 'rejected'], { status: 'approved', approvedAt: new Date(), $unset: { rejectionReason: 1 } });
      tellCustomer(review, 'review_approved', (p) => `Your review of ${p} is live`, (p) => `Thanks for reviewing ${p}! Your review is now published on our store.`);
      break;
    case 'reject': {
      const reason = cleanText(body.reason, 300);
      if (!reason) throw new HttpError(400, 'Please note why you’re rejecting it (only you see this).');
      review = await setStatus(id, ['pending', 'approved', 'hidden'], { status: 'rejected', rejectionReason: reason });
      break;
    }
    case 'hide':
      review = await setStatus(id, ['approved'], { status: 'hidden' });
      break;
    case 'unhide':
      review = await setStatus(id, ['hidden'], { status: 'approved' });
      break;
    case 'reply': {
      const text = cleanText(body.text, 1000);
      if (!text) throw new HttpError(400, 'Please write your reply.');
      const before = await Review.findById(requireObjectId(id, 'We couldn’t find that review.'), { adminReply: 1 }).lean();
      if (!before) throw new HttpError(404, 'We couldn’t find that review.');
      review = await Review.findByIdAndUpdate(id, { adminReply: { text, at: new Date() } }, { new: true });
      if (!before.adminReply?.text) {
        tellCustomer(review, 'review_replied', (p) => `SHOPME replied to your review of ${p}`, (p) => `We replied to your review of ${p}:\n\n"${text}"`);
      }
      break;
    }
    case 'delete-reply':
      review = await Review.findByIdAndUpdate(requireObjectId(id, 'We couldn’t find that review.'), { $unset: { adminReply: 1 } }, { new: true });
      if (!review) throw new HttpError(404, 'We couldn’t find that review.');
      break;
    default:
      throw new HttpError(400, 'That action isn’t possible.');
  }
  return { id: review._id, status: review.status, reply: review.adminReply?.text ? review.adminReply : undefined, rejectionReason: review.rejectionReason };
}

export async function bulkApprove(body = {}) {
  const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 200).map(String).filter((x) => /^[a-f0-9]{24}$/i.test(x));
  if (!ids.length) throw new HttpError(400, 'Please select at least one review.');
  let approved = 0;
  for (const id of ids) {
    try {
      await reviewAction(id, 'approve');
      approved += 1;
    } catch {
      // already approved or changed: skip
    }
  }
  return { approved, skipped: ids.length - approved };
}

// ---------- Reminder 3 days after delivery (PRD §11.5) ----------
export async function sendReviewReminders(now = new Date()) {
  const due = new Date(now.getTime() - REVIEW_RULES.reminderDays * 86400000);
  const tooOld = new Date(now.getTime() - 30 * 86400000);
  const orders = await Order.find(
    { 'shipping.deliveredAt': { $lte: due, $gte: tooOld }, reviewReminderSent: { $ne: true }, ...DELIVERED },
    { _id: 1 },
  ).limit(200).lean();
  let sent = 0;
  for (const { _id } of orders) {
    // Claim first so two servers never send the same reminder
    const order = await Order.findOneAndUpdate({ _id, reviewReminderSent: { $ne: true } }, { reviewReminderSent: true }, { new: true }).lean();
    if (!order) continue;
    const reviewed = await Review.find({ order: order._id }, { product: 1 }).lean();
    const done = new Set(reviewed.map((r) => String(r.product)));
    const open = [...new Map(order.items.filter((i) => !done.has(String(i.product))).map((i) => [String(i.product), i])).values()];
    if (!open.length) continue;
    const [user, settings] = await Promise.all([User.findById(order.user, { name: 1, email: 1 }).lean(), getSettings()]);
    if (!user?.email) continue;
    await sendEmail({
      event: 'review_reminder',
      to: user.email,
      subject: `How do you like your ${open[0].name}${open.length > 1 ? ` and ${open.length - 1} more` : ''}?`,
      text: `Hi ${user.name},\n\nWe hope you're enjoying your order ${order.orderNumber}. Could you spare a minute to review it? Your photos and thoughts help other shoppers.\n\n${open.map((i) => `- ${i.name}: ${env.storeUrl}/account/orders/${order.orderNumber}/review/${i.product}`).join('\n')}\n\nThank you!\n${settings.store.name}`,
    });
    sent += 1;
  }
  return sent;
}

// Account deletion: the customer's reviews go too (Privacy Policy), ratings updated
export async function deleteReviewsOfUser(userId) {
  const products = await Review.distinct('product', { user: userId });
  await Review.deleteMany({ user: userId });
  await Review.updateMany({ helpfulVoters: userId }, { $pull: { helpfulVoters: userId } });
  for (const p of products) await recomputeRatings(p);
  return products.length;
}
