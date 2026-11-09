import { Router } from 'express';
import { lookupPincode } from '../integrations/pincode.js';
import { getPage, getPublicSettings } from '../services/settingsService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();

// 'returns' and 'cancellation' are older names for the combined Refund & Cancellation Policy
const PAGES = ['about', 'privacy', 'terms', 'shipping', 'refunds', 'faq'];
const ALIASES = { returns: 'refunds', cancellation: 'refunds' };

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json(await getPublicSettings());
  }),
);

router.get(
  '/pages/:name',
  asyncHandler(async (req, res) => {
    const name = ALIASES[req.params.name] || req.params.name;
    if (!PAGES.includes(name)) throw new HttpError(404, 'Page not found.');
    res.json({ name, content: await getPage(name) });
  }),
);

// City and state for a pincode (address forms). Limited per connection.
const pinLog = new Map();
router.get(
  '/pincode/:pincode',
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const recent = (pinLog.get(req.ip) || []).filter((t) => now - t < 10 * 60000);
    if (recent.length >= 60) throw new HttpError(429, 'Too many pincode lookups. Please type the city and state.');
    recent.push(now);
    pinLog.set(req.ip, recent);
    if (pinLog.size > 5000) pinLog.clear();
    const result = await lookupPincode(req.params.pincode);
    // Browsers may keep a found answer; a "not found" is asked again next time
    res.set('Cache-Control', result.found ? 'public, max-age=86400' : 'no-store');
    res.json(result);
  }),
);

export default router;
