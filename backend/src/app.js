import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { UPLOADS_URL } from './integrations/media.js';
import { REFRESH_HEADER } from './middleware/requireAdmin.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import apiRoutes from './routes/index.js';
import { razorpayWebhook } from './routes/orderRoutes.js';
import path from 'node:path';
import { renderStorePage, robotsTxt, sitemapXml } from './services/seoService.js';
import { asyncHandler } from './utils/asyncHandler.js';

export function createApp() {
  const app = express();
  // Behind a hosting proxy (Render, Nginx…) the real visitor address is in
  // X-Forwarded-For; set TRUST_PROXY=1 there so per-visitor limits work
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');
  // Smaller responses on mobile data (PRD §17.1); photos are already compressed WebP
  app.use(compression({ threshold: 1024 }));

  // Product photos are shown on the store and admin sites (other origins in production)
  // Security headers. The content policy lists the outside services the store
  // and admin pages use when this server hosts them: Razorpay (payment window),
  // Google Maps (store location), Google Fonts and Cloudinary (photos/videos).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://checkout.razorpay.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.razorpay.com', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com'],
          mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'", 'https://*.razorpay.com', 'https://api.cloudinary.com'],
          frameSrc: ["'self'", 'https://*.razorpay.com', 'https://www.google.com', 'https://maps.google.com'],
          formAction: ["'self'", 'https://*.razorpay.com'],
          frameAncestors: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.clientUrls, credentials: true, exposedHeaders: [REFRESH_HEADER] }));
  // Razorpay's webhook needs the raw bytes for its signature check
  app.post('/api/payments/razorpay/webhook', express.raw({ type: () => true, limit: '1mb' }), razorpayWebhook);
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeRequest);
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Uploaded photos & videos (development storage). File names are unique,
  // so browsers may cache them for a long time.
  app.use(UPLOADS_URL, express.static(env.uploadsPath, { maxAge: '30d', immutable: true, index: false }));

  app.use('/api', apiRoutes);

  // Search engines (PRD §17.4). Also at /api/seo/… for when the store is hosted separately.
  const sitemap = asyncHandler(async (req, res) => res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await sitemapXml()));
  const robots = (req, res) => res.type('text/plain').send(robotsTxt());
  app.get(['/sitemap.xml', '/api/seo/sitemap.xml'], sitemap);
  app.get(['/robots.txt', '/api/seo/robots.txt'], robots);

  // Single-server hosting: built admin panel at /admin, built store at /
  if (env.adminDist) {
    app.use('/admin', express.static(env.adminDist, { index: false, maxAge: '7d' }));
    app.get(/^\/admin(\/.*)?$/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(env.adminDist, 'index.html')));
  }
  if (env.storeDist) {
    // Hashed files (assets) can be cached for a long time; pages always fresh
    app.use(express.static(env.storeDist, { index: false, maxAge: '7d' }));
    app.get(
      /^\/(?!api\/|uploads\/).*/,
      asyncHandler(async (req, res, next) => {
        if (path.extname(req.path)) return next(); // a missing file: 404
        const html = await renderStorePage(req.originalUrl);
        if (!html) return next();
        res.set('Cache-Control', 'no-cache').type('html').send(html);
      }),
    );
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
