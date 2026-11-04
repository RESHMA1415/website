import { REFRESH_AFTER_SECONDS, signAdminToken, verifyAdminToken } from '../services/adminAuthService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

export const REFRESH_HEADER = 'X-Admin-Token';

// Protects every admin API route. Admin tokens use their own secret, so a
// customer login can never open admin functions.
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please log in to continue.');

  const { admin, issuedAt } = await verifyAdminToken(token);
  req.admin = admin;

  // Sliding session: active admins get a fresh 2-hour token
  if (Date.now() / 1000 - issuedAt > REFRESH_AFTER_SECONDS) {
    res.set(REFRESH_HEADER, signAdminToken(admin));
  }
  next();
});
