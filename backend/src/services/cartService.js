import { Cart, Product } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { requireObjectId, toWholeNumber } from '../utils/text.js';
import { calculateTotals, discountPercent, variantPrice } from './pricingService.js';
import { getSettings } from './settingsService.js';

// Shopping cart (PRD §4, §6.2, §6.3, §13.7). Prices, totals and stock checks
// are always worked out here from live product data, never from the browser.
// A cart belongs to a logged-in customer ({ userId }) or a guest ({ guestId });
// the guest cart joins the customer's cart when they log in.
const MAX_LINES = 50;
export const GUEST_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

const ownerFilter = (owner) => (owner.userId ? { user: owner.userId } : { guestId: owner.guestId });
const sameLine = (item, productId, variantId) => String(item.product) === String(productId) && String(item.variantId) === String(variantId);
export const optionLabel = (o = {}) => [o.colour, o.size, o.shade, o.volume].filter(Boolean).join(' / ');

export function photoFor(product, variant) {
  const images = product.images || [];
  const image = images.find((i) => i.colour && i.colour === variant?.options?.colour) || images[0];
  return image ? image.thumbUrl || image.mediumUrl || image.url : '';
}

export async function loadProducts(ids) {
  const products = await Product.find(
    { _id: { $in: ids } },
    { name: 1, slug: 1, brand: 1, status: 1, mrp: 1, sellingPrice: 1, productType: 1, images: 1, variants: 1, isReturnable: 1 },
  ).lean();
  return new Map(products.map((p) => [String(p._id), p]));
}

// Turns stored cart lines into what the cart page shows, with warnings
export async function buildCartView(cart) {
  const settings = await getSettings();
  const maxPerItem = settings.orders.maxQtyPerItem;
  const items = cart?.items || [];
  const products = await loadProducts([...new Set(items.map((i) => String(i.product)))]);

  const lines = items.map((item) => {
    const product = products.get(String(item.product));
    const variant = product?.variants.find((v) => String(v._id) === String(item.variantId));
    const base = { _id: item._id, productId: item.product, variantId: item.variantId, quantity: item.quantity };
    if (!product || product.status !== 'active' || !variant) {
      return { ...base, name: product?.name || 'This product', status: 'unavailable', message: 'This product is no longer available. Please remove it.' };
    }
    const { mrp, price } = variantPrice(product, variant);
    const maxQuantity = Math.max(0, Math.min(maxPerItem, variant.stock));
    let status = 'ok';
    let message = '';
    if (variant.stock === 0) {
      status = 'out_of_stock';
      message = 'This option is sold out. Please remove it or move it to your wishlist.';
    } else if (item.quantity > variant.stock) {
      status = 'limited';
      message = `Only ${variant.stock} available. Please reduce the quantity.`;
    } else if (item.quantity > maxPerItem) {
      status = 'limited';
      message = `You can buy up to ${maxPerItem} of each item. Please reduce the quantity.`;
    }
    const priceChanged = item.priceWhenAdded != null && item.priceWhenAdded !== price ? { from: item.priceWhenAdded, to: price } : null;
    return {
      ...base,
      status,
      message,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      productType: product.productType,
      imageUrl: photoFor(product, variant),
      options: variant.options,
      optionLabel: optionLabel(variant.options),
      sku: variant.sku,
      mrp,
      price,
      discountPercent: discountPercent(mrp, price),
      lineTotal: price * item.quantity,
      stock: variant.stock,
      maxQuantity,
      priceChanged,
      isReturnable: product.isReturnable,
    };
  });

  // Only lines that can be bought now count towards the totals
  const buyable = lines.filter((l) => l.status === 'ok');
  const totals = calculateTotals(buyable, settings, 'online');
  return {
    items: lines,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    summary: { ...totals, freeDeliveryThreshold: settings.delivery.freeDeliveryThreshold },
    canCheckout: lines.length > 0 && lines.every((l) => l.status === 'ok'),
    maxPerItem,
  };
}

export async function getCart(owner) {
  return buildCartView(await Cart.findOne(ownerFilter(owner)).lean());
}

async function loadBuyable(productId, variantId) {
  const pid = requireObjectId(productId, 'We couldn’t find that product.');
  const vid = requireObjectId(variantId, 'Please choose a size or colour first.');
  const product = await Product.findOne({ _id: pid, status: 'active' }, { name: 1, mrp: 1, sellingPrice: 1, variants: 1 }).lean();
  if (!product) throw new HttpError(404, 'This product is no longer available.');
  const variant = product.variants.find((v) => String(v._id) === vid);
  if (!variant) throw new HttpError(404, 'That option is no longer available. Please choose another.');
  return { product, variant };
}

function checkQuantity(quantity, variant, maxPerItem, alreadyInCart = 0) {
  if (variant.stock === 0) throw new HttpError(409, 'Sorry, this option is sold out.');
  if (quantity > variant.stock) {
    throw new HttpError(409, alreadyInCart
      ? `Only ${variant.stock} available, and you already have ${alreadyInCart} in your cart.`
      : `Only ${variant.stock} available.`);
  }
  if (quantity > maxPerItem) {
    throw new HttpError(409, alreadyInCart
      ? `You can buy up to ${maxPerItem} of each item, and you already have ${alreadyInCart} in your cart.`
      : `You can buy up to ${maxPerItem} of each item.`);
  }
}

export async function addToCart(owner, { productId, variantId, quantity = 1 }) {
  const qty = toWholeNumber(quantity, 'quantity', { min: 1, max: 100 });
  const { product, variant } = await loadBuyable(productId, variantId);
  const { orders } = await getSettings();

  const cart = (await Cart.findOne(ownerFilter(owner))) || new Cart({ ...ownerFilter(owner), items: [] });
  const line = cart.items.find((i) => sameLine(i, product._id, variant._id));
  const current = line?.quantity || 0;
  checkQuantity(current + qty, variant, orders.maxQtyPerItem, current);

  const { price } = variantPrice(product, variant);
  if (line) {
    line.quantity = current + qty;
    line.priceWhenAdded = price;
  } else {
    if (cart.items.length >= MAX_LINES) throw new HttpError(400, `Your cart can hold up to ${MAX_LINES} different items.`);
    cart.items.push({ product: product._id, variantId: variant._id, quantity: qty, priceWhenAdded: price });
  }
  await saveCart(cart);
  return buildCartView(cart.toObject());
}

// Two tabs adding at once can both try to create the cart; the second one retries
async function saveCart(cart) {
  try {
    await cart.save();
  } catch (err) {
    if (err.code !== 11000 || !cart.isNew) throw err;
    const existing = await Cart.findOne(cart.user ? { user: cart.user } : { guestId: cart.guestId });
    for (const item of cart.items) {
      const line = existing.items.find((i) => sameLine(i, item.product, item.variantId));
      if (line) line.quantity = Math.max(line.quantity, item.quantity);
      else existing.items.push(item);
    }
    await existing.save();
    cart.items = existing.items;
  }
}

export function findCartLine(cart, itemId) {
  const line = cart?.items.id(requireObjectId(itemId, 'We couldn’t find that item in your cart.'));
  if (!line) throw new HttpError(404, 'That item is no longer in your cart.');
  return line;
}

export async function updateCartItem(owner, itemId, { quantity }) {
  const qty = toWholeNumber(quantity, 'quantity', { min: 0, max: 100 });
  const cart = await Cart.findOne(ownerFilter(owner));
  const line = findCartLine(cart, itemId);
  if (qty === 0) {
    line.deleteOne();
  } else if (qty > line.quantity) {
    // Increasing needs stock; decreasing is always allowed (it fixes warnings)
    const { product, variant } = await loadBuyable(line.product, line.variantId);
    const { orders } = await getSettings();
    checkQuantity(qty, variant, orders.maxQtyPerItem);
    line.quantity = qty;
    line.priceWhenAdded = variantPrice(product, variant).price;
  } else {
    line.quantity = qty;
    const product = await Product.findById(line.product, { mrp: 1, sellingPrice: 1, variants: 1 }).lean();
    const variant = product?.variants.find((v) => String(v._id) === String(line.variantId));
    if (variant) line.priceWhenAdded = variantPrice(product, variant).price; // the customer has now seen the price
  }
  await cart.save();
  return buildCartView(cart.toObject());
}

export async function removeCartItem(owner, itemId) {
  const cart = await Cart.findOne(ownerFilter(owner));
  findCartLine(cart, itemId).deleteOne();
  await cart.save();
  return buildCartView(cart.toObject());
}

// When a guest logs in or registers, their cart joins their account's cart.
// Quantities are added up, but never beyond the per-item limit or stock.
export async function mergeGuestCart(guestId, userId) {
  if (!guestId || !GUEST_ID_PATTERN.test(guestId)) return;
  const guest = await Cart.findOne({ guestId });
  if (!guest?.items.length) {
    if (guest) await guest.deleteOne();
    return;
  }
  const { orders } = await getSettings();
  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] });
  const products = await loadProducts(guest.items.map((i) => i.product));
  for (const item of guest.items) {
    const variant = products.get(String(item.product))?.variants.find((v) => String(v._id) === String(item.variantId));
    const limit = Math.max(1, Math.min(orders.maxQtyPerItem, variant?.stock || 1));
    const line = cart.items.find((i) => sameLine(i, item.product, item.variantId));
    if (line) line.quantity = Math.min(limit, line.quantity + item.quantity);
    else if (cart.items.length < MAX_LINES) cart.items.push({ product: item.product, variantId: item.variantId, quantity: Math.min(limit, item.quantity), priceWhenAdded: item.priceWhenAdded });
  }
  await saveCart(cart);
  await guest.deleteOne();
}

