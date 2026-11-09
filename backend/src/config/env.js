import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

// Development data (database files, uploaded photos) lives outside the project
// folder so cloud-sync tools such as OneDrive never touch it
const localDataRoot = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
  'shopme',
);

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  clientUrls: (process.env.CLIENT_URLS || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET,
  adminJwtSecret: process.env.ADMIN_JWT_SECRET,
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
  // Customer website address, used in links inside emails (e.g. password reset)
  storeUrl: (process.env.STORE_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  // Admin panel address, for links in alert emails to the owner
  adminUrl: (process.env.ADMIN_URL || 'http://localhost:5174').replace(/\/+$/, ''),
  localDbPath: process.env.LOCAL_DB_PATH || path.join(localDataRoot, 'db'),
  uploadsPath: process.env.UPLOADS_PATH || path.join(localDataRoot, 'uploads'),
};

export const isProduction = env.nodeEnv === 'production';

if (!env.adminJwtSecret || env.adminJwtSecret.startsWith('change-me')) {
  if (isProduction) throw new Error('ADMIN_JWT_SECRET must be set to a long random value in production');
}
if (!env.jwtSecret || env.jwtSecret.startsWith('change-me')) {
  if (isProduction) throw new Error('JWT_SECRET must be set to a long random value in production');
  if (!env.jwtSecret) throw new Error('JWT_SECRET is missing from backend/.env');
}
if (env.jwtSecret && env.jwtSecret === env.adminJwtSecret) {
  throw new Error('JWT_SECRET and ADMIN_JWT_SECRET must be different, so customer logins can never open the admin panel');
}
