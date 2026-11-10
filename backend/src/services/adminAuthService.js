import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { EMAIL_CONNECTED, sendEmail } from '../integrations/email.js';
import { Admin } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';

// Admin login rules (PRD §17.2): one admin account, encrypted password,
// 15-minute lock after 5 wrong attempts, session ends after 2 hours idle.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
export const SESSION_HOURS = 2;
// A fresh token is handed out once the current one is this old, so the
// 2 hours count from the last activity rather than from login
export const REFRESH_AFTER_SECONDS = 10 * 60;

const WRONG_DETAILS = 'The email or password is incorrect.';

export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Use at least 8 characters, with at least one letter and one number.');
  }
}

// Creates the single admin account the first time the server starts
export async function ensureAdminAccount() {
  if (await Admin.exists({})) return false;
  if (!env.adminEmail || !env.adminInitialPassword) {
    console.warn('No admin account yet: set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in backend/.env');
    return false;
  }
  validatePasswordStrength(env.adminInitialPassword);
  await Admin.create({
    name: 'Store Admin',
    email: env.adminEmail,
    passwordHash: await bcrypt.hash(env.adminInitialPassword, 12),
  });
  console.log(`Admin account created for ${env.adminEmail}`);
  return true;
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: String(admin._id), role: 'admin' }, env.adminJwtSecret, {
    expiresIn: `${SESSION_HOURS}h`,
  });
}

export function publicAdmin(admin) {
  return { _id: admin._id, name: admin.name, email: admin.email, lastLoginAt: admin.lastLoginAt, twoStepEnabled: Boolean(admin.twoStepEnabled) };
}

// ---------- Two-step login: a 6-digit code emailed to the admin ----------
const CODE_MINUTES = 10;
const CODE_TRIES = 5;
const codeHash = (adminId, code) => crypto.createHmac('sha256', env.adminJwtSecret).update(`${adminId}:${code}`).digest('hex');

async function emailCode(admin, purpose) {
  const last = admin.twoStep?.sentAt ? new Date(admin.twoStep.sentAt).getTime() : 0;
  if (Date.now() - last < 30000) throw new HttpError(429, 'A code was just sent. Please wait 30 seconds before asking for another.');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await Admin.updateOne(
    { _id: admin._id },
    { twoStep: { codeHash: codeHash(admin._id, code), purpose, expiresAt: new Date(Date.now() + CODE_MINUTES * 60000), attempts: 0, sentAt: new Date() } },
  );
  const sent = await sendEmail({
    event: 'admin_login_code',
    to: admin.email,
    subject: `${code} is your SHOPME admin code`,
    text: `Your SHOPME admin ${purpose === 'login' ? 'login' : 'two-step setup'} code is:\n\n${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't try to log in, change your admin password now.`,
  });
  if (!sent.delivered && !sent.logged) throw new HttpError(502, 'We couldn’t email the code. Please try again in a moment.');
  return { sent: true, to: admin.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2') };
}

async function checkCode(adminId, purpose, rawCode) {
  const code = String(rawCode || '').replace(/\D/g, '');
  if (code.length !== 6) throw new HttpError(400, 'Please enter the 6-digit code from the email.');
  const admin = await Admin.findById(adminId).select('+twoStep.codeHash');
  const t = admin?.twoStep;
  if (!t?.codeHash || t.purpose !== purpose) throw new HttpError(400, 'Please ask for a new code.');
  if (t.expiresAt < new Date()) throw new HttpError(400, 'This code has expired. Please ask for a new one.');
  const a = Buffer.from(t.codeHash);
  const b = Buffer.from(codeHash(adminId, code));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const counted = await Admin.findOneAndUpdate({ _id: adminId, 'twoStep.purpose': purpose }, { $inc: { 'twoStep.attempts': 1 } }, { new: true });
    const left = CODE_TRIES - (counted?.twoStep?.attempts ?? CODE_TRIES);
    if (left <= 0) {
      await Admin.updateOne({ _id: adminId }, { $unset: { twoStep: 1 } });
      throw new HttpError(429, 'Too many wrong codes. Please start again.');
    }
    throw new HttpError(400, `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }
  // Used exactly once
  const used = await Admin.findOneAndUpdate({ _id: adminId, 'twoStep.codeHash': t.codeHash }, { $unset: { twoStep: 1 } }, { new: true });
  if (!used) throw new HttpError(400, 'Please ask for a new code.');
  return used;
}

// Short-lived pass between "password OK" and "code OK"
const signChallenge = (admin) => jwt.sign({ sub: String(admin._id), role: 'admin-2fa' }, env.adminJwtSecret, { expiresIn: `${CODE_MINUTES}m` });

export async function verifyAdminLoginCode(challenge, code) {
  let payload;
  try {
    payload = jwt.verify(String(challenge || ''), env.adminJwtSecret);
  } catch {
    throw new HttpError(401, 'This login has expired. Please enter your email and password again.');
  }
  if (payload.role !== 'admin-2fa') throw new HttpError(401, 'Please log in again.');
  await checkCode(payload.sub, 'login', code);
  const loggedIn = await Admin.findOneAndUpdate({ _id: payload.sub }, { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } }, { new: true });
  return { token: signAdminToken(loggedIn), admin: publicAdmin(loggedIn) };
}

export async function resendAdminLoginCode(challenge) {
  let payload;
  try {
    payload = jwt.verify(String(challenge || ''), env.adminJwtSecret);
  } catch {
    throw new HttpError(401, 'This login has expired. Please enter your email and password again.');
  }
  const admin = await Admin.findById(payload.sub).lean();
  if (!admin || payload.role !== 'admin-2fa') throw new HttpError(401, 'Please log in again.');
  return emailCode(admin, 'login');
}

// Turning it on needs a code that really arrived, so the owner can't lock themselves out
export async function startTwoStepSetup(adminId) {
  if (!EMAIL_CONNECTED) throw new HttpError(409, 'Store emails aren’t set up yet. Connect email first (My Account → Store emails), then turn this on.');
  const admin = await Admin.findById(adminId).lean();
  return emailCode(admin, 'enable');
}

export async function confirmTwoStep(adminId, code) {
  await checkCode(adminId, 'enable', code);
  const admin = await Admin.findByIdAndUpdate(adminId, { twoStepEnabled: true }, { new: true });
  return publicAdmin(admin);
}

export async function disableTwoStep(adminId, password) {
  const admin = await Admin.findById(adminId).select('+passwordHash');
  if (!admin || !(await bcrypt.compare(String(password || ''), admin.passwordHash))) throw new HttpError(400, 'Your password is incorrect.');
  admin.twoStepEnabled = false;
  await admin.save();
  return publicAdmin(admin);
}

// Change the login email (needs the password). Two-step login is switched off,
// to be turned on again once a code reaches the new address.
export async function changeAdminEmail(adminId, { password, email }) {
  const admin = await Admin.findById(adminId).select('+passwordHash');
  if (!admin || !(await bcrypt.compare(String(password || ''), admin.passwordHash))) throw new HttpError(400, 'Your password is incorrect.');
  const next = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(next)) throw new HttpError(400, 'Please enter a valid email address.');
  if (next === admin.email) throw new HttpError(400, 'That is already your login email.');
  admin.email = next;
  admin.twoStepEnabled = false;
  await admin.save();
  return publicAdmin(admin);
}

export async function loginAdmin(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Please enter your email and password.');
  }
  const admin = await Admin.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!admin) throw new HttpError(401, WRONG_DETAILS);

  if (isLocked(admin)) throw lockedError(admin.lockedUntil);

  if (!(await bcrypt.compare(password, admin.passwordHash))) {
    // Counted with an atomic $inc so parallel guesses can't all read the same count
    const counted = await Admin.findOneAndUpdate({ _id: admin._id }, { $inc: { failedLoginCount: 1 } }, { new: true });
    if (isLocked(counted)) throw lockedError(counted.lockedUntil);
    if (counted.failedLoginCount >= MAX_ATTEMPTS) {
      await Admin.updateOne(
        { _id: admin._id },
        { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) },
      );
      throw new HttpError(423, `Too many wrong attempts. Login is locked for ${LOCK_MINUTES} minutes.`);
    }
    const left = MAX_ATTEMPTS - counted.failedLoginCount;
    throw new HttpError(401, `${WRONG_DETAILS} ${left} attempt${left === 1 ? '' : 's'} left before login is locked.`);
  }

  // Two-step login: the password was right; now a code is emailed
  // (If store email has stopped working, fall back to the password so the owner is never locked out)
  if (admin.twoStepEnabled && !EMAIL_CONNECTED) console.warn('Two-step admin login is on but email is not connected: password-only login used');
  if (admin.twoStepEnabled && EMAIL_CONNECTED) {
    await Admin.updateOne({ _id: admin._id }, { failedLoginCount: 0 });
    const sent = await emailCode(admin, 'login');
    return { twoStep: true, challenge: signChallenge(admin), ...sent };
  }

  // Only succeeds if no parallel request locked the account while the password was checked
  const now = new Date();
  const loggedIn = await Admin.findOneAndUpdate(
    { _id: admin._id, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
    { $set: { failedLoginCount: 0, lastLoginAt: now }, $unset: { lockedUntil: 1 } },
    { new: true },
  );
  if (!loggedIn) throw lockedError((await Admin.findById(admin._id).lean())?.lockedUntil);
  return { token: signAdminToken(loggedIn), admin: publicAdmin(loggedIn) };
}

function isLocked(admin) {
  return Boolean(admin?.lockedUntil && admin.lockedUntil > new Date());
}

function lockedError(lockedUntil) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil) - Date.now()) / 60000));
  return new HttpError(423, `Too many wrong attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
}

// Returns the admin for a valid token, or throws 401
export async function verifyAdminToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.adminJwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has ended. Please log in again.');
  }
  if (payload.role !== 'admin') throw new HttpError(401, 'Please log in again.');
  const admin = await Admin.findById(payload.sub).lean();
  // Tokens issued before a password change no longer work (1 s clock tolerance)
  if (!admin || payload.iat * 1000 < new Date(admin.passwordChangedAt).getTime() - 1000) {
    throw new HttpError(401, 'Your session has ended. Please log in again.');
  }
  return { admin, issuedAt: payload.iat };
}

export async function changeAdminPassword(adminId, currentPassword, newPassword) {
  const admin = await Admin.findById(adminId).select('+passwordHash');
  if (!admin || !(await bcrypt.compare(String(currentPassword || ''), admin.passwordHash))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  validatePasswordStrength(newPassword);
  if (await bcrypt.compare(newPassword, admin.passwordHash)) {
    throw new HttpError(400, 'Please choose a password different from the current one.');
  }
  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  admin.passwordChangedAt = new Date();
  await admin.save();
  // Hand back a new login so this browser stays signed in
  return { token: signAdminToken(admin), admin: publicAdmin(admin) };
}
