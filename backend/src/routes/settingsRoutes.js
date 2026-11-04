import { Router } from 'express';
import { getPage, getPublicSettings } from '../services/settingsService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();

const PAGES = ['about', 'privacy', 'terms', 'shipping', 'returns', 'cancellation', 'faq'];

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json(await getPublicSettings());
  }),
);

router.get(
  '/pages/:name',
  asyncHandler(async (req, res) => {
    if (!PAGES.includes(req.params.name)) throw new HttpError(404, 'Page not found.');
    res.json({ name: req.params.name, content: await getPage(req.params.name) });
  }),
);

export default router;
