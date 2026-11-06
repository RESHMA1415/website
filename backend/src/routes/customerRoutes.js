import { Router } from 'express';
import { GUEST_HEADER, cartOwner, optionalCustomer, requireCustomer } from '../middleware/requireCustomer.js';
import {
  addAddress,
  deleteAccount,
  deleteAddress,
  getProfile,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  updateProfile,
} from '../services/accountService.js';
import { addToCart, buildCartView, getCart, mergeGuestCart, removeCartItem, updateCartItem } from '../services/cartService.js';
import {
  changeCustomerPassword,
  loginCustomer,
  requestPasswordReset,
  resetPassword,
} from '../services/customerAuthService.js';
import { loginWithOtp, registerWithOtp, requestOtp } from '../services/otpService.js';
import { addToWishlist, getWishlist, moveCartItemToWishlist, removeFromWishlist, wishlistIds } from '../services/wishlistService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Customer accounts, cart and wishlist (PRD Phase 3)
const router = Router();
const handle = (fn) => asyncHandler(async (req, res) => res.json(await fn(req, res)));

// After login or register, a guest's cart joins the account (PRD §4)
async function withMergedCart(req, session) {
  await mergeGuestCart(req.get(GUEST_HEADER), session.user._id).catch((err) => console.error('Cart merge failed', err));
  return session;
}

// ----- Login & registration -----
// Registration needs the mobile number confirmed with an SMS code
router.post('/auth/register', handle(async (req) => withMergedCart(req, await registerWithOtp(req.body || {}))));
router.post('/auth/login', handle(async (req) => withMergedCart(req, await loginCustomer(req.body || {}))));
// SMS OTP: send a code (login or register), then log in with it
router.post('/auth/otp/request', handle((req) => requestOtp(req.body || {}, { ip: req.ip })));
router.post('/auth/otp/login', handle(async (req) => withMergedCart(req, await loginWithOtp(req.body || {}))));
router.post('/auth/forgot-password', handle((req) => requestPasswordReset(req.body?.email)));
router.post('/auth/reset-password', handle(async (req) => withMergedCart(req, await resetPassword(req.body || {}))));
router.get('/auth/me', requireCustomer, handle((req) => getProfile(req.customer._id)));

// ----- My Account -----
router.get('/account/profile', requireCustomer, handle((req) => getProfile(req.customer._id)));
router.put('/account/profile', requireCustomer, handle((req) => updateProfile(req.customer._id, req.body || {})));
router.put('/account/password', requireCustomer, handle((req) => changeCustomerPassword(req.customer._id, req.body || {})));
router.get('/account/addresses', requireCustomer, handle((req) => listAddresses(req.customer._id)));
router.post('/account/addresses', requireCustomer, handle((req) => addAddress(req.customer._id, req.body || {})));
router.put('/account/addresses/:id', requireCustomer, handle((req) => updateAddress(req.customer._id, req.params.id, req.body || {})));
router.put('/account/addresses/:id/default', requireCustomer, handle((req) => setDefaultAddress(req.customer._id, req.params.id)));
router.delete('/account/addresses/:id', requireCustomer, handle((req) => deleteAddress(req.customer._id, req.params.id)));
// Delete my account (DPDP Act right to erasure)
router.post('/account/delete', requireCustomer, handle((req) => deleteAccount(req.customer._id, req.body || {})));

// ----- Cart (guests too) -----
router.get('/cart', optionalCustomer, handle(async (req) => {
  const owner = cartOwner(req, { required: false });
  return owner ? getCart(owner) : buildCartView(null);
}));
router.post('/cart/items', optionalCustomer, handle((req) => addToCart(cartOwner(req), req.body || {})));
router.patch('/cart/items/:id', optionalCustomer, handle((req) => updateCartItem(cartOwner(req), req.params.id, req.body || {})));
router.delete('/cart/items/:id', optionalCustomer, handle((req) => removeCartItem(cartOwner(req), req.params.id)));
router.post('/cart/items/:id/move-to-wishlist', requireCustomer, handle((req) => moveCartItemToWishlist(req.customer._id, req.params.id)));

// ----- Wishlist (customers only) -----
router.get('/wishlist', requireCustomer, handle((req) => getWishlist(req.customer._id)));
router.get('/wishlist/ids', requireCustomer, handle((req) => wishlistIds(req.customer._id)));
router.post('/wishlist/:productId', requireCustomer, handle((req) => addToWishlist(req.customer._id, req.params.productId)));
router.delete('/wishlist/:productId', requireCustomer, handle((req) => removeFromWishlist(req.customer._id, req.params.productId)));

export default router;
