import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { LEGAL_VERSION } from '../content/legal/index.js';
import { SHOW_EMAIL_LINKS_ON_SCREEN, sendEmail } from '../integrations/email.js';
import { User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { MOBILE_PATTERN, normaliseMobile } from '../utils/india.js';
import { cleanText, requireText } from '../utils/text.js';
import { getSettings } from './settingsService.js';

// Customer accounts (PRD §4, §13.9, §17.2). Customer tokens use JWT_SECRET,
// which is different from the admin secret, so they can never open admin routes.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_MINUTES = 30;
const RESET_COOLDOWN_SECONDS = 60;
// "Remember me" keeps the customer signed in for 30 days; otherwise 1 day
// (and the website forgets the login when the browser closes)
const SESSION_DAYS = { remember: 30, normal: 1 };

const WRONG_DETAILS = 'The email/mobile or password is incorrect.';
const BLOCKED = 'This account has been blocked. Please contact us for help.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 100 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Use at least 8 characters, with at least one letter and one number.');
  }
}

export function cleanEmail(value) {
  const email = cleanText(value, 120).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  return email;
}

export function cleanMobile(value, label = 'mobile number') {
  const mobile = normaliseMobile(value);
  if (!MOBILE_PATTERN.test(mobile)) throw new HttpError(400, `Please enter a valid 10-digit ${label}.`);
  return mobile;
}

export function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    gender: user.gender || '',
    dateOfBirth: user.dateOfBirth || null,
    consentAt: user.consent?.termsAndPrivacyAcceptedAt || null,
    policyVersion: user.consent?.policyVersion || null,
    createdAt: user.createdAt,
  };
}

function signCustomerToken(user, remember) {
  const days = remember ? SESSION_DAYS.remember : SESSION_DAYS.normal;
  return jwt.sign({ sub: String(user._id), role: 'customer' }, env.jwtSecret, { expiresIn: `${days}d` });
}

async function welcomeEmail(user) {
  const { store } = await getSettings();
  await sendEmail({
    event: 'account_registered',
    to: user.email,
    subject: `Welcome to ${store.name}!`,
    text: `Hi ${user.name},\n\nYour ${store.name} account is ready. You can now save a wishlist, check out faster and track your orders.\n\nShop now: ${env.storeUrl}\n\nNeed help? Reply to this email or WhatsApp us on ${store.phone}.`,
  });
}

export async function registerCustomer(body) {
  const name = requireText(body.name, 'full name', 80);
  const email = cleanEmail(body.email);
  const mobile = cleanMobile(body.mobile);
  validatePassword(body.password);
  if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
    throw new HttpError(400, 'The two passwords don’t match.');
  }
  // Consent must be a clear, separate yes from the customer (DPDP Act)
  if (body.agreeTerms !== true) throw new HttpError(400, 'Please agree to the Terms & Conditions and Privacy Policy to create an account.');

  const [emailTaken, mobileTaken] = await Promise.all([User.exists({ email }), User.exists({ mobile })]);
  if (emailTaken) throw new HttpError(409, 'An account with this email already exists. Please log in instead.');
  if (mobileTaken) throw new HttpError(409, 'An account with this mobile number already exists. Please log in instead.');

  let user;
  try {
    user = await User.create({
      name,
      email,
      mobile,
      passwordHash: await bcrypt.hash(body.password, 12),
      lastLoginAt: new Date(),
      consent: { termsAndPrivacyAcceptedAt: new Date(), policyVersion: LEGAL_VERSION },
    });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An account with these details already exists. Please log in instead.');
    throw err;
  }
  welcomeEmail(user).catch(() => {}); // never blocks registration
  return { token: signCustomerToken(user, Boolean(body.remember)), user: publicUser(user) };
}

function isLocked(user) {
  return Boolean(user?.lockedUntil && user.lockedUntil > new Date());
}

function lockedError(lockedUntil) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil) - Date.now()) / 60000));
  return new HttpError(423, `Too many wrong attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`);
}

// Log in with email or mobile number (PRD §13.9)
export async function loginCustomer({ identifier, password, remember }) {
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    throw new HttpError(400, 'Please enter your email or mobile number and your password.');
  }
  const id = identifier.trim();
  const query = id.includes('@') ? { email: id.toLowerCase() } : { mobile: normaliseMobile(id) };
  const user = await User.findOne(query).select('+passwordHash');
  if (!user) throw new HttpError(401, WRONG_DETAILS);
  if (user.isBlocked) throw new HttpError(403, BLOCKED);
  if (isLocked(user)) throw lockedError(user.lockedUntil);

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    // Atomic $inc so parallel guesses can't all read the same count
    const counted = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginCount: 1 } }, { new: true });
    if (isLocked(counted)) throw lockedError(counted.lockedUntil);
    if (counted.failedLoginCount >= MAX_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) });
      throw new HttpError(423, `Too many wrong attempts. Login is locked for ${LOCK_MINUTES} minutes. You can reset your password instead.`);
    }
    const left = MAX_ATTEMPTS - counted.failedLoginCount;
    throw new HttpError(401, `${WRONG_DETAILS} ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  // Only succeeds if no parallel request locked the account meanwhile
  const now = new Date();
  const loggedIn = await User.findOneAndUpdate(
    { _id: user._id, isBlocked: { $ne: true }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
    { $set: { failedLoginCount: 0, lastLoginAt: now }, $unset: { lockedUntil: 1 } },
    { new: true },
  );
  if (!loggedIn) throw lockedError((await User.findById(user._id).lean())?.lockedUntil || now);
  return { token: signCustomerToken(loggedIn, Boolean(remember)), user: publicUser(loggedIn) };
}

// Returns the customer for a valid token, or throws 401/403
export async function verifyCustomerToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your login has expired. Please log in again.');
  }
  if (payload.role !== 'customer') throw new HttpError(401, 'Please log in again.');
  const user = await User.findById(payload.sub).lean();
  // Logins issued before a password change or reset no longer work (1 s tolerance)
  if (!user || payload.iat * 1000 < new Date(user.passwordChangedAt).getTime() - 1000) {
    throw new HttpError(401, 'Your login has expired. Please log in again.');
  }
  if (user.isBlocked) throw new HttpError(403, BLOCKED);
  return user;
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const SENT_MESSAGE = 'If an account exists for this email, we’ve sent a link to reset your password. It is valid for 30 minutes.';

// Always answers the same way, so nobody can find out which emails have accounts
export async function requestPasswordReset(emailInput) {
  const email = cleanEmail(emailInput);
  const user = await User.findOne({ email }).select('+passwordResetRequestedAt');
  if (!user || user.isBlocked) return { message: SENT_MESSAGE };
  if (user.passwordResetRequestedAt && Date.now() - user.passwordResetRequestedAt < RESET_COOLDOWN_SECONDS * 1000) {
    throw new HttpError(429, 'We’ve just sent you a reset link. Please check your inbox (and spam), or try again in a minute.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  await User.updateOne(
    { _id: user._id },
    { passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60000), passwordResetRequestedAt: new Date() },
  );
  const link = `${env.storeUrl}/reset-password?token=${token}`;
  const { store } = await getSettings();
  await sendEmail({
    event: 'password_reset',
    to: user.email,
    subject: `Reset your ${store.name} password`,
    text: `Hi ${user.name},\n\nWe received a request to reset your password. Open this link within ${RESET_MINUTES} minutes to choose a new one:\n\n${link}\n\nIf you didn’t ask for this, you can ignore this email. Your password stays the same.`,
  });
  return { message: SENT_MESSAGE, ...(SHOW_EMAIL_LINKS_ON_SCREEN ? { devResetLink: link } : {}) };
}

export async function resetPassword({ token, password }) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new HttpError(400, 'This reset link is not valid. Please request a new one.');
  }
  validatePassword(password);
  const now = new Date();
  const user = await User.findOneAndUpdate(
    { passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: now } },
    {
      $set: { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: now, failedLoginCount: 0 },
      $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1, lockedUntil: 1 },
    },
    { new: true },
  );
  if (!user) throw new HttpError(400, 'This reset link has expired or was already used. Please request a new one.');
  if (user.isBlocked) throw new HttpError(403, BLOCKED);
  return { token: signCustomerToken(user, false), user: publicUser(user) };
}

export async function changeCustomerPassword(userId, { currentPassword, newPassword, remember }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  validatePassword(newPassword);
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new HttpError(400, 'Please choose a password different from the current one.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  // Other devices are signed out; this one gets a fresh login
  return { token: signCustomerToken(user, Boolean(remember)), user: publicUser(user) };
}
