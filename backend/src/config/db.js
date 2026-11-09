import fs from 'node:fs';
import net from 'node:net';
import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

// Kept outside the project folder so cloud-sync tools (e.g. OneDrive) never
// touch live database files
const dataDir = env.localDbPath;
const LOCAL_PORT = 27027;

let localServer;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// True while something still answers on the port (e.g. the previous run's
// database, which is still shutting down after an automatic restart)
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

// In development with no MONGODB_URI, run a private local MongoDB whose data
// persists between restarts. Production must always supply MONGODB_URI.
// After an automatic restart (node --watch) the old database may still be
// closing, so we wait for port 27027 to be free and retry. We never accept a
// different port: tools and tests expect the database on 27027.
async function startLocalDatabase() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(dataDir, { recursive: true });
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    for (let waited = 0; waited < 30 && (await portInUse(LOCAL_PORT)); waited += 1) await sleep(1000);
    try {
      const server = await MongoMemoryServer.create({
        instance: { dbPath: dataDir, storageEngine: 'wiredTiger', port: LOCAL_PORT, launchTimeout: 30000 },
      });
      const port = Number(new URL(server.getUri()).port);
      if (port === LOCAL_PORT) {
        localServer = server;
        return server.getUri('shopme');
      }
      await server.stop({ doCleanup: false });
      lastError = new Error(`Port ${LOCAL_PORT} was busy (got ${port})`);
    } catch (err) {
      lastError = err; // usually the old database still holds its files
    }
    console.log(`Local database not ready yet (${lastError.message}); trying again (${attempt}/6)…`);
    await sleep(3000);
  }
  throw lastError;
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
