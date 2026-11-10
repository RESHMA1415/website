// Restores the database from a SHOPME backup file.
//
//   npm run restore --prefix backend -- <backup file>            (empty database only)
//   npm run restore --prefix backend -- <backup file> --replace  (wipes and replaces every backed-up collection)
//   npm run restore --prefix backend -- <backup file> --check    (only opens the file and lists what is inside)
//
// Encrypted backups (.enc) need the same BACKUP_KEY in backend/.env as when they
// were made. Stop the store server first. Online copies can be downloaded from
// Cloudinary (Media Library → shopme/backups) or from the admin's backup list.
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { readBackupFile } from '../services/backupService.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const replace = args.includes('--replace');
const checkOnly = args.includes('--check');

if (!file) {
  console.error('Please give the backup file, e.g. npm run restore --prefix backend -- C:\\backups\\shopme-backup-2026-11-10T20-30-00.json.gz.enc');
  process.exit(1);
}

const backup = await readBackupFile(await fs.readFile(file));
const names = Object.keys(backup.collections);
console.log(`Backup made ${backup.createdAt}: ${names.length} collections`);
for (const n of names) console.log(`  ${n.padEnd(24)} ${backup.collections[n].length}`);
if (checkOnly) process.exit(0);

await connectDatabase();
const db = mongoose.connection.db;
const existing = [];
for (const n of names) {
  const count = await db.collection(n).estimatedDocumentCount().catch(() => 0);
  if (count) existing.push(`${n} (${count})`);
}
if (existing.length && !replace) {
  console.error(`\nThe database already has data: ${existing.join(', ')}.\nNothing was changed. Add --replace to wipe these collections and restore the backup.`);
  await disconnectDatabase();
  process.exit(1);
}
for (const n of names) {
  const docs = backup.collections[n];
  if (replace) await db.collection(n).deleteMany({});
  for (let i = 0; i < docs.length; i += 1000) await db.collection(n).insertMany(docs.slice(i, i + 1000), { ordered: false });
}
console.log(`\nRestored ${names.length} collections. Start the server again; indexes are rebuilt on start.`);
await disconnectDatabase();
