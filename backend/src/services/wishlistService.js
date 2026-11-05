import mongoose from 'mongoose';
import { Cart, Product, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { isObjectId, requireObjectId } from '../utils/text.js';
import { buildCartView, findCartLine, loadProducts, optionLabel } from './cartService.js';
import { discountPercent, variantPrice } from './pricingService.js';
import { getSettings } from './settingsService.js';

// Wishlist (PRD §13.6). Customers only; prices come from live product data.
const MAX_WISHLIST = 200;

export async function wishlistIds(userId) {
  const user = await User.findById(userId, { 'wishlist.product': 1 }).lean();
  return (user?.wishlist || []).map((w) => String(w.product));
}

export async function getWishlist(userId) {
  const user = await User.findById(userId, { wishlist: 1 }).lean();
  const entries = [...(user?.wishlist || [])].reverse(); // newest first
  const products = await loadProducts(entries.map((w) => w.product));
  const { orders } = await getSettings();
  return entries.map((entry) => {
    const p = products.get(String(entry.product));
    if (!p || p.status !== 'active') return { productId: entry.product, available: false, name: p?.name || 'This product', addedAt: entry.addedAt };
    const variants = p.variants.map((v) => ({ _id: v._id, options: v.options, optionLabel: optionLabel(v.options), stock: v.stock, ...variantPrice(p, v) }));
    return {
      productId: p._id,
      available: true,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      productType: p.productType,
      image: p.images?.[0] || null,
      mrp: p.mrp,
      price: p.sellingPrice,
      discountPercent: discountPercent(p.mrp, p.sellingPrice),
      inStock: p.variants.some((v) => v.stock > 0),
      variants,
      maxPerItem: orders.maxQtyPerItem,
      priceWhenAdded: entry.priceWhenAdded,
      priceDropped: entry.priceWhenAdded != null && p.sellingPrice < entry.priceWhenAdded ? entry.priceWhenAdded - p.sellingPrice : 0,
      addedAt: entry.addedAt,
    };
  });
}

export async function addToWishlist(userId, productId) {
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const product = await Product.findOne({ _id: pid, status: 'active' }, { sellingPrice: 1 }).lean();
  if (!product) throw new HttpError(404, 'This product is no longer available.');
  const user = await User.findById(userId, { wishlist: 1 }).lean();
  if (user.wishlist.some((w) => String(w.product) === pid)) return wishlistIds(userId);
  if (user.wishlist.length >= MAX_WISHLIST) throw new HttpError(400, `Your wishlist can hold up to ${MAX_WISHLIST} products. Please remove some first.`);
  // The $ne condition keeps this atomic if the heart is tapped twice quickly
  await User.updateOne(
    { _id: userId, 'wishlist.product': { $ne: new mongoose.Types.ObjectId(pid) } },
    { $push: { wishlist: { product: pid, priceWhenAdded: product.sellingPrice, addedAt: new Date() } } },
  );
  return wishlistIds(userId);
}

export async function removeFromWishlist(userId, productId) {
  if (!isObjectId(productId)) throw new HttpError(404, 'We couldn’t find that product.');
  await User.updateOne({ _id: userId }, { $pull: { wishlist: { product: productId } } });
  return wishlistIds(userId);
}

// Cart → wishlist (PRD §13.7 "move to wishlist")
export async function moveCartItemToWishlist(userId, itemId) {
  const cart = await Cart.findOne({ user: userId });
  const line = findCartLine(cart, itemId);
  await addToWishlist(userId, line.product).catch((err) => {
    if (!(err instanceof HttpError && err.status === 404)) throw err; // a removed product just leaves the cart
  });
  line.deleteOne();
  await cart.save();
  return { cart: await buildCartView(cart.toObject()), wishlist: await wishlistIds(userId) };
}
