import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env, isProduction } from './config/env.js';
import { Product } from './models/index.js';
import { ensureEssentials, seedIfEmpty } from './seed/seeder.js';
import { ensureAdminAccount } from './services/adminAuthService.js';
import { expireUnpaidOrders } from './services/orderService.js';
import { sendReviewReminders } from './services/reviewService.js';
import { retryFailedEmails } from './integrations/email.js';
import { sendLowStockSummary } from './services/messageService.js';
import { nightlyBackup } from './services/backupService.js';
import { cloudinaryConfigured } from './integrations/cloudinary.js';

async function start() {
  await connectDatabase();
  // Brings product indexes in line with the schema (e.g. the unique SKU index)
  await Product.syncIndexes();
  if (!isProduction && (await seedIfEmpty())) console.log('Fresh database: starter data added');
  // Production: a new database gets settings, policy pages and the category menu (no sample products)
  if (await ensureEssentials()) console.log('New database: settings, policy pages and categories added');
  await ensureAdminAccount();

  // Unpaid online orders are closed after 30 minutes (PRD §8.1)
  const sweep = () => expireUnpaidOrders().catch((err) => console.error('Expiring unpaid orders failed', err));
  sweep();
  setInterval(sweep, 5 * 60 * 1000).unref();
  // Review reminder 3 days after delivery (PRD §11.5), checked every hour
  const remind = () => sendReviewReminders().catch((err) => console.error('Review reminders failed', err));
  setTimeout(remind, 60 * 1000).unref();
  setInterval(remind, 60 * 60 * 1000).unref();
  // Failed emails are tried again (up to 3 times); the stock alert goes out once a day after 9 AM
  setInterval(() => retryFailedEmails().catch((err) => console.error('Email retry failed', err)), 5 * 60 * 1000).unref();
  const stockAlert = () => sendLowStockSummary().catch((err) => console.error('Low-stock summary failed', err));
  setTimeout(stockAlert, 2 * 60 * 1000).unref();
  setInterval(stockAlert, 30 * 60 * 1000).unref();
  // Daily database backup after 2 AM India time, kept for 30 days (PRD §17)
  const backup = () => nightlyBackup().catch((err) => console.error('Nightly backup failed', err));
  setTimeout(backup, 3 * 60 * 1000).unref();
  setInterval(backup, 30 * 60 * 1000).unref();
  if (isProduction && !cloudinaryConfigured()) console.warn('Warning: Cloudinary is not set up. Photos and backups are stored on this server only.');
  if (isProduction && !(process.env.BACKUP_KEY || '').trim()) console.warn('Warning: BACKUP_KEY is not set, so database backups stay on this server and are not copied online.');
  const server = createApp().listen(env.port, () => {
    console.log(`SHOPME API running at http://localhost:${env.port}/api`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start the server:', err);
  process.exit(1);
});
