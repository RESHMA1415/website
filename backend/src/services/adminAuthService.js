import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
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
  return { _id: admin._id, name: admin.name, email: admin.email, lastLoginAt: admin.lastLoginAt };
}

export async function loginAdmin(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Please enter your email and password.');
  }
  const admin = await Admin.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!admin) throw new HttpError(401, WRONG_DETAILS);

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const minutes = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
    throw new HttpError(423, `Too many wrong attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  if (!(await bcrypt.compare(password, admin.passwordHash))) {
    const attempts = admin.failedLoginCount + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await Admin.updateOne(
        { _id: admin._id },
        { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) },
      );
      throw new HttpError(423, `Too many wrong attempts. Login is locked for ${LOCK_MINUTES} minutes.`);
    }
    await Admin.updateOne({ _id: admin._id }, { failedLoginCount: attempts });
    const left = MAX_ATTEMPTS - attempts;
    throw new HttpError(401, `${WRONG_DETAILS} ${left} attempt${left === 1 ? '' : 's'} left before login is locked.`);
  }

  admin.failedLoginCount = 0;
  admin.lockedUntil = undefined;
  admin.lastLoginAt = new Date();
  await admin.save();
  return { token: signAdminToken(admin), admin: publicAdmin(admin) };
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
