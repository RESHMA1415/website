import { verifyCustomerToken } from '../services/customerAuthService.js';
import { GUEST_ID_PATTERN } from '../services/cartService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

export const GUEST_HEADER = 'X-Guest-Id';

function bearer(req) {
  const header = req.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

// Routes only logged-in customers may use (wishlist, My Account…)
export const requireCustomer = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Please log in to continue.');
  req.customer = await verifyCustomerToken(token);
  next();
});

// Routes guests may use too (cart). A sent but expired login is reported, so
// the website can sign the customer out rather than silently showing a guest cart.
export const optionalCustomer = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (token) req.customer = await verifyCustomerToken(token);
  next();
});

// Who the cart belongs to: the customer, or the guest's random browser id
export function cartOwner(req, { required = true } = {}) {
  if (req.customer) return { userId: req.customer._id };
  const guestId = req.get(GUEST_HEADER) || '';
  if (GUEST_ID_PATTERN.test(guestId)) return { guestId };
  if (required) throw new HttpError(400, 'Please refresh the page and try again.');
  return null;
}
