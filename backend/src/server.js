import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env, isProduction } from './config/env.js';
import { Product } from './models/index.js';
import { seedIfEmpty } from './seed/seeder.js';
import { ensureAdminAccount } from './services/adminAuthService.js';
import { expireUnpaidOrders } from './services/orderService.js';

async function start() {
  await connectDatabase();
  // Brings product indexes in line with the schema (e.g. the unique SKU index)
  await Product.syncIndexes();
  if (!isProduction && (await seedIfEmpty())) console.log('Fresh database: starter data added');
  await ensureAdminAccount();

  // Unpaid online orders are closed after 30 minutes (PRD §8.1)
  const sweep = () => expireUnpaidOrders().catch((err) => console.error('Expiring unpaid orders failed', err));
  sweep();
  setInterval(sweep, 5 * 60 * 1000).unref();
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
