import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { UPLOADS_URL } from './integrations/media.js';
import { REFRESH_HEADER } from './middleware/requireAdmin.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  // Product photos are shown on the store and admin sites (other origins in production)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientUrls, credentials: true, exposedHeaders: [REFRESH_HEADER] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Uploaded photos & videos (development storage). File names are unique,
  // so browsers may cache them for a long time.
  app.use(UPLOADS_URL, express.static(env.uploadsPath, { maxAge: '30d', immutable: true, index: false }));

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
