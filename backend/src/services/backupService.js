import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { cloudinaryConfigured, cloudinaryDestroy, cloudinaryListRaw, cloudinaryUpload } from '../integrations/cloudinary.js';
import { sendEmail } from '../integrations/email.js';
import { BackupLog, Counter } from '../models/index.js';
import { getSettings } from './settingsService.js';

// Daily database backup (PRD §17: "daily, kept for 30 days"; owner's choice:
// SHOPME's own backup, stored in Cloudinary).
// Every collection is written as Extended JSON (keeps ids and dates exact),
// gzip-compressed and, with BACKUP_KEY set, encrypted (AES-256-GCM). The file
// goes to Cloudinary as a private file and a copy is kept on the server disk.
// Copies older than BACKUP_KEEP_DAYS (30) are deleted. Restore with
// `npm run restore --prefix backend -- <file>` (see src/scripts/restore.js).

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const { EJSON } = mongoose.mongo.BSON;

export const BACKUP_RULES = {
  hourIndia: 2, // runs once a day after 2 AM India time, when the store is quiet
  skipCollections: ['otps'], // short-lived login codes: useless after 5 minutes
  cloudPrefix: 'backups/',
};
const MAGIC = Buffer.from('SHMBK1'); // encrypted backup file header

const keepDays = () => Math.max(1, Number(process.env.BACKUP_KEEP_DAYS) || 30);
const backupKey = () => (process.env.BACKUP_KEY || '').trim();
export const backupEncrypted = () => backupKey().length >= 16;

function encrypt(data, secret) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

function decrypt(file, secret) {
  if (!secret) throw new Error('This backup is encrypted: set BACKUP_KEY in backend/.env to the key used when it was made.');
  const at = MAGIC.length;
  const salt = file.subarray(at, at + 16);
  const iv = file.subarray(at + 16, at + 28);
  const tag = file.subarray(at + 28, at + 44);
  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(file.subarray(at + 44)), decipher.final()]);
  } catch {
    throw new Error('Could not open this backup: BACKUP_KEY is not the key it was made with, or the file is damaged.');
  }
}

/** Builds the backup file. Returns { buffer, fileName, collections, documents }. */
export async function createBackupFile(now = new Date()) {
  const db = mongoose.connection.db;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.') && !BACKUP_RULES.skipCollections.includes(n))
    .sort();
  const collections = {};
  let documents = 0;
  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs;
    documents += docs.length;
  }
  const json = EJSON.stringify({ format: 'shopme-backup', version: 1, createdAt: now.toISOString(), database: db.databaseName, collections }, { relaxed: false });
  let buffer = await gzip(Buffer.from(json, 'utf8'));
  const encrypted = backupEncrypted();
  if (encrypted) buffer = encrypt(buffer, backupKey());
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `shopme-backup-${stamp}${encrypted ? '.json.gz.enc' : '.json.gz'}`;
  return { buffer, fileName, encrypted, collections: names.length, documents };
}

/** Opens a backup file (encrypted or not) and returns its parsed contents. */
export async function readBackupFile(buffer, secret = backupKey()) {
  let data = buffer;
  if (data.subarray(0, MAGIC.length).equals(MAGIC)) data = decrypt(data, secret);
  const json = (await gunzip(data)).toString('utf8');
  const parsed = EJSON.parse(json, { relaxed: false });
  if (parsed?.format !== 'shopme-backup' || typeof parsed.collections !== 'object') throw new Error('This is not a SHOPME backup file.');
  return parsed;
}

async function pruneLocal(now) {
  const cutoff = now.getTime() - keepDays() * 86400000;
  const files = await fs.readdir(env.backupPath).catch(() => []);
  for (const f of files) {
    if (!/^shopme-backup-.*\.json\.gz(\.enc)?$/.test(f)) continue;
    const full = path.join(env.backupPath, f);
    const stat = await fs.stat(full).catch(() => null);
    if (stat && stat.mtimeMs < cutoff) await fs.rm(full, { force: true });
  }
}

async function pruneCloud(now) {
  const cutoff = now.getTime() - keepDays() * 86400000;
  const list = await cloudinaryListRaw(BACKUP_RULES.cloudPrefix, { type: 'authenticated' });
  let removed = 0;
  for (const f of list) {
    if (new Date(f.createdAt).getTime() < cutoff) {
      await cloudinaryDestroy(f.publicId, 'raw', 'authenticated');
      removed += 1;
    }
  }
  return removed;
}

async function alertOwner(log) {
  try {
    const settings = await getSettings();
    const to = settings.notifications?.adminAlertEmail;
    if (!to) return;
    await sendEmail({
      event: 'backup_failed',
      to,
      subject: 'SHOPME: last night’s database backup did not complete',
      text: [
        'The automatic database backup did not complete.',
        `- Online copy (Cloudinary): ${log.cloud?.saved ? 'saved' : `not saved${log.cloud?.error ? ` (${log.cloud.error})` : ''}`}`,
        `- Server copy: ${log.local?.saved ? 'saved' : `not saved${log.local?.error ? ` (${log.local.error})` : ''}`}`,
        'The store keeps working normally. Please ask your developer to check it; you can also try "Back up now" in the admin under My Account → Database backups.',
      ].join('\n'),
      action: env.adminUrl ? { label: 'Open backups', url: `${env.adminUrl}/account` } : undefined,
    });
  } catch (err) {
    console.error('[backup] could not send the failure alert:', err.message);
  }
}

/** Makes one backup now: online copy (Cloudinary) + server copy. Never throws. */
export async function runBackup({ trigger = 'nightly', now = new Date() } = {}) {
  const started = Date.now();
  const log = { trigger, cloud: { saved: false }, local: { saved: false } };
  try {
    const file = await createBackupFile(now);
    Object.assign(log, { fileName: file.fileName, bytes: file.buffer.length, collections: file.collections, documents: file.documents, encrypted: file.encrypted });

    // Online copy: only when encrypted, because it holds customer data
    if (!cloudinaryConfigured()) log.cloud.error = 'Cloudinary is not set up';
    else if (!file.encrypted) log.cloud.error = 'BACKUP_KEY is not set, so the online copy was skipped (backups must be encrypted before leaving the server)';
    else {
      try {
        const up = await cloudinaryUpload(file.buffer, { resourceType: 'raw', type: 'authenticated', publicId: `${BACKUP_RULES.cloudPrefix}${file.fileName}`, fileName: file.fileName });
        log.cloud = { saved: true, publicId: up.publicId };
        await pruneCloud(now).catch((err) => console.error('[backup] removing old online copies failed:', err.message));
      } catch (err) {
        log.cloud = { saved: false, error: err.message.slice(0, 300) };
      }
    }

    try {
      await fs.mkdir(env.backupPath, { recursive: true });
      const full = path.join(env.backupPath, file.fileName);
      await fs.writeFile(full, file.buffer);
      log.local = { saved: true, path: full };
      await pruneLocal(now).catch((err) => console.error('[backup] removing old server copies failed:', err.message));
    } catch (err) {
      log.local = { saved: false, error: err.message.slice(0, 300) };
    }

    const cloudWanted = cloudinaryConfigured();
    log.status = log.local.saved && (log.cloud.saved || !cloudWanted) ? 'ok' : log.local.saved || log.cloud.saved ? 'partial' : 'failed';
  } catch (err) {
    log.status = 'failed';
    log.error = err.message.slice(0, 300);
  }
  log.seconds = Math.round((Date.now() - started) / 100) / 10;
  const saved = await BackupLog.create(log).catch((err) => {
    console.error('[backup] could not record the backup:', err.message);
    return log;
  });
  if (log.status === 'ok') console.log(`[backup] ${log.fileName} saved (${log.documents} records, ${Math.round(log.bytes / 1024)} KB)`);
  else {
    console.error(`[backup] ${log.status}:`, log.error || log.cloud.error || log.local.error);
    await alertOwner(log);
  }
  return saved;
}

/** Called every 30 minutes by server.js: one backup per India day, after 2 AM. */
export async function nightlyBackup(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  if (ist.getUTCHours() < BACKUP_RULES.hourIndia) return { ran: false, reason: 'before 2 AM' };
  const dayKey = `backup-${ist.toISOString().slice(0, 10)}`;
  try {
    await Counter.create({ _id: dayKey, seq: 1 }); // claimed once, even with several servers
  } catch (err) {
    if (err.code === 11000) return { ran: false, reason: 'already done today' };
    throw err;
  }
  const log = await runBackup({ trigger: 'nightly', now });
  return { ran: true, status: log.status };
}

/** Admin: setup status and the latest backups. */
export async function backupStatus() {
  const items = await BackupLog.find().sort({ createdAt: -1 }).limit(30).lean();
  return {
    cloudinary: cloudinaryConfigured(),
    encrypted: backupEncrypted(),
    keepDays: keepDays(),
    hourIndia: BACKUP_RULES.hourIndia,
    lastOk: items.find((b) => b.status === 'ok')?.createdAt || null,
    items: items.map((b) => ({ id: b._id, createdAt: b.createdAt, status: b.status, trigger: b.trigger, fileName: b.fileName, bytes: b.bytes, documents: b.documents, encrypted: b.encrypted, cloudSaved: Boolean(b.cloud?.saved), localSaved: Boolean(b.local?.saved), problem: b.error || b.cloud?.error || b.local?.error || '' })),
  };
}

// One manual backup at a time
let manualRunning = false;
export async function backupNow() {
  if (manualRunning) return { started: false, message: 'A backup is already running. Please wait a moment.' };
  manualRunning = true;
  try {
    const log = await runBackup({ trigger: 'admin' });
    return { started: true, status: log.status };
  } finally {
    manualRunning = false;
  }
}
