import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env, isProduction } from './config/env.js';
import { seedIfEmpty } from './seed/seeder.js';
import { ensureAdminAccount } from './services/adminAuthService.js';

async function start() {
  await connectDatabase();
  if (!isProduction && (await seedIfEmpty())) console.log('Fresh database: starter data added');
  await ensureAdminAccount();
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
