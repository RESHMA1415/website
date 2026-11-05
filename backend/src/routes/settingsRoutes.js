import { Router } from 'express';
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

export default router;
