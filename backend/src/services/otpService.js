import crypto from 'node:crypto';
import { env, isProduction } from '../config/env.js';
import { otpMessage, sendSms, smsConfigured } from '../integrations/sms.js';
import { Otp, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanText } from '../utils/text.js';
import { cleanMobile, publicUser, registerCustomer, signCustomerToken } from './customerAuthService.js';

// 6-digit SMS OTP for login and registration.
export const OTP_RULES = {
  digits: 6,
  validMinutes: 5, // a code works for 5 minutes
  maxAttempts: 5, // wrong tries per code before it is cancelled
  resendSeconds: 30, // wait between codes for the same number
  maxPerHour: 5, // codes per number per hour
  maxPerIpPer15Min: 15, // codes requested from one connection (protects the SMS wallet)
};
const PURPOSES = ['login', 'register'];

// Codes are stored only as a keyed hash
const hashCode = (mobile, purpose, code) => crypto.createHmac('sha256', env.jwtSecret).update(`${mobile}:${purpose}:${code}`).digest('hex');
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// In development without a configured gateway the code is shown on screen instead of sent
export const SHOW_OTP_ON_SCREEN = !isProduction && !smsConfigured();

const ipLog = new Map(); // ip -> [timestamps]
function limitIp(ip) {
  if (!ip) return;
  const now = Date.now();
  const recent = (ipLog.get(ip) || []).filter((t) => now - t < 15 * 60000);
  if (recent.length >= OTP_RULES.maxPerIpPer15Min) {
    throw new HttpError(429, 'Too many code requests from this connection. Please try again in 15 minutes.');
  }
  recent.push(now);
  ipLog.set(ip, recent);
  if (ipLog.size > 5000) ipLog.clear(); // keep memory bounded
}

function cleanPurpose(purpose) {
  if (!PURPOSES.includes(purpose)) throw new HttpError(400, 'Please try again.');
  return purpose;
}

/**
 * Sends a new code. Answers with how long until another can be requested.
 * login: the number must belong to an active account; register: it must not.
 */
export async function requestOtp({ mobile: rawMobile, purpose: rawPurpose }, { ip } = {}) {
  const purpose = cleanPurpose(rawPurpose);
  const mobile = cleanMobile(rawMobile);

  const user = await User.findOne({ mobile }, { isBlocked: 1 }).lean();
  if (purpose === 'login' && !user) throw new HttpError(404, 'No account uses this mobile number. Please create an account first.');
  if (purpose === 'login' && user.isBlocked) throw new HttpError(403, 'This account has been blocked. Please contact us for help.');
  if (purpose === 'register' && user) throw new HttpError(409, 'An account with this mobile number already exists. Please log in instead.');

  const last = await Otp.findOne({ mobile, purpose }).sort({ createdAt: -1 }).lean();
  if (last) {
    const wait = OTP_RULES.resendSeconds - Math.floor((Date.now() - last.createdAt) / 1000);
    if (wait > 0) throw Object.assign(new HttpError(429, `Please wait ${wait} seconds before asking for a new code.`), { retryAfter: wait });
  }
  const lastHour = await Otp.countDocuments({ mobile, createdAt: { $gt: new Date(Date.now() - 3600000) } });
  if (lastHour >= OTP_RULES.maxPerHour) throw new HttpError(429, 'Too many codes for this number. Please try again in an hour.');
  if (!smsConfigured() && isProduction) throw new HttpError(503, 'Login by SMS code isn’t available right now. Please use your password.');
  limitIp(ip);

  const code = String(crypto.randomInt(0, 10 ** OTP_RULES.digits)).padStart(OTP_RULES.digits, '0');
  // Any older unused code for this number and purpose stops working
  await Otp.updateMany({ mobile, purpose, consumed: false }, { consumed: true });
  const otp = await Otp.create({ mobile, purpose, codeHash: hashCode(mobile, purpose, code), expiresAt: new Date(Date.now() + OTP_RULES.validMinutes * 60000) });

  if (smsConfigured()) {
    const sent = await sendSms({ mobile, message: otpMessage(code), event: `otp_${purpose}` });
    if (!sent.ok) {
      await Otp.updateOne({ _id: otp._id }, { consumed: true });
      throw new HttpError(502, sent.friendly);
    }
  } else {
    console.log(`[OTP not sent: SMS gateway not configured] ${purpose} code for ${mobile}: ${code}`);
  }
  return {
    sent: true,
    mobile: `******${mobile.slice(-4)}`,
    expiresInSeconds: OTP_RULES.validMinutes * 60,
    resendInSeconds: OTP_RULES.resendSeconds,
    ...(SHOW_OTP_ON_SCREEN ? { devOtp: code } : {}),
  };
}

/** Checks a code; on success it is used up and cannot be used again. */
export async function verifyOtp({ mobile: rawMobile, purpose: rawPurpose, code: rawCode }) {
  const purpose = cleanPurpose(rawPurpose);
  const mobile = cleanMobile(rawMobile);
  const code = cleanText(rawCode, 10).replace(/\D/g, '');
  if (code.length !== OTP_RULES.digits) throw new HttpError(400, `Please enter the ${OTP_RULES.digits}-digit code.`);

  const otp = await Otp.findOne({ mobile, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!otp) throw new HttpError(400, 'Please request a new code.');
  if (otp.expiresAt < new Date()) {
    await Otp.updateOne({ _id: otp._id }, { consumed: true });
    throw new HttpError(400, 'This code has expired. Please request a new one.');
  }
  if (!safeEqual(otp.codeHash, hashCode(mobile, purpose, code))) {
    // Counted atomically so parallel guesses can't exceed the limit
    const counted = await Otp.findOneAndUpdate({ _id: otp._id, consumed: false }, { $inc: { attempts: 1 } }, { new: true });
    const left = OTP_RULES.maxAttempts - (counted?.attempts ?? OTP_RULES.maxAttempts);
    if (left <= 0) {
      await Otp.updateOne({ _id: otp._id }, { consumed: true });
      throw new HttpError(429, 'Too many wrong codes. Please request a new code.');
    }
    throw new HttpError(400, `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }
  // Use the code exactly once, even if two requests arrive together
  const used = await Otp.findOneAndUpdate(
    { _id: otp._id, consumed: false, attempts: { $lt: OTP_RULES.maxAttempts } },
    { consumed: true },
    { new: true },
  );
  if (!used) throw new HttpError(400, 'Please request a new code.');
  return { mobile, purpose };
}

/** Login with mobile + OTP → the same customer login (JWT) as password login. */
export async function loginWithOtp({ mobile, code, remember }) {
  const verified = await verifyOtp({ mobile, purpose: 'login', code });
  const now = new Date();
  const user = await User.findOneAndUpdate(
    { mobile: verified.mobile, isBlocked: { $ne: true } },
    { $set: { lastLoginAt: now, mobileVerifiedAt: now } },
    { new: true },
  );
  if (!user) throw new HttpError(403, 'This account can’t log in. Please contact us for help.');
  return { token: signCustomerToken(user, Boolean(remember)), user: publicUser(user) };
}

/** Registration with the mobile number proven by OTP. */
export async function registerWithOtp(body) {
  return registerCustomer(body, {
    verifyMobile: (mobile) => verifyOtp({ mobile, purpose: 'register', code: body.otp }),
  });
}
