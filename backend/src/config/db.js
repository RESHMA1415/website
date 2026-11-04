import fs from 'node:fs';
import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

// Kept outside the project folder so cloud-sync tools (e.g. OneDrive) never
// touch live database files
const dataDir = env.localDbPath;
const LOCAL_PORT = 27027;

let localServer;

// In development with no MONGODB_URI, run a private local MongoDB whose data
// persists between restarts. Production must always supply MONGODB_URI.
async function startLocalDatabase() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(dataDir, { recursive: true });
  localServer = await MongoMemoryServer.create({
    instance: { dbPath: dataDir, storageEngine: 'wiredTiger', port: LOCAL_PORT, launchTimeout: 60000 },
  });
  return localServer.getUri('shopme');
}

export async function connectDatabase() {
  let uri = env.mongodbUri;
  if (!uri) {
    if (isProduction) throw new Error('MONGODB_URI must be set in production');
    uri = await startLocalDatabase();
    console.log(`Using local development database (data in ${dataDir})`);
  }
  await mongoose.connect(uri);
  console.log('Database connected');
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (localServer) await localServer.stop({ doCleanup: false });
}
