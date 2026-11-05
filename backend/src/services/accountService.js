import bcrypt from 'bcryptjs';
import { sendEmail } from '../integrations/email.js';
import { Cart, DeletionLog, Order, User } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { INDIAN_STATES, PINCODE_PATTERN } from '../utils/india.js';
import { cleanText, requireObjectId, requireText } from '../utils/text.js';
import { cleanEmail, cleanMobile, publicUser } from './customerAuthService.js';
import { getSettings } from './settingsService.js';

// My Account: profile and saved addresses (PRD §13.10, §13.8 address fields)
const MAX_ADDRESSES = 10;
const GENDERS = ['', 'female', 'male', 'other'];

async function loadUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'Please log in again.');
  return user;
}

export async function getProfile(userId) {
  return publicUser(await loadUser(userId));
}

export async function updateProfile(userId, body) {
  const user = await loadUser(userId);
  const name = requireText(body.name, 'full name', 80);
  const email = cleanEmail(body.email);
  const mobile = cleanMobile(body.mobile);
  const gender = GENDERS.includes(body.gender) ? body.gender : '';

  let dateOfBirth = null;
  if (body.dateOfBirth) {
    dateOfBirth = new Date(body.dateOfBirth);
    const age = (Date.now() - dateOfBirth) / (365.25 * 86400000);
    if (Number.isNaN(dateOfBirth.getTime()) || age < 5 || age > 120) throw new HttpError(400, 'Please enter a valid date of birth.');
  }

  if (email !== user.email && (await User.exists({ email, _id: { $ne: user._id } }))) {
    throw new HttpError(409, 'Another account already uses this email.');
  }
  if (mobile !== user.mobile && (await User.exists({ mobile, _id: { $ne: user._id } }))) {
    throw new HttpError(409, 'Another account already uses this mobile number.');
  }
  Object.assign(user, { name, email, mobile, gender, dateOfBirth });
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'Another account already uses this email or mobile number.');
    throw err;
  }
  return publicUser(user);
}

// ---------- Addresses ----------

export function cleanAddress(body) {
  const pincode = cleanText(body.pincode, 6);
  if (!PINCODE_PATTERN.test(pincode)) throw new HttpError(400, 'Please enter a valid 6-digit pincode.');
  const state = cleanText(body.state, 60);
  if (!INDIAN_STATES.includes(state)) throw new HttpError(400, 'Please choose your state.');
  const alternate = cleanText(body.alternateMobile, 15);
  return {
    fullName: requireText(body.fullName, 'full name', 80),
    mobile: cleanMobile(body.mobile),
    alternateMobile: alternate ? cleanMobile(alternate, 'alternate mobile number') : undefined,
    pincode,
    house: requireText(body.house, 'house / flat / building', 120),
    street: requireText(body.street, 'street / area', 160),
    landmark: cleanText(body.landmark, 120) || undefined,
    city: requireText(body.city, 'city', 60),
    state,
    type: body.type === 'work' ? 'work' : 'home',
  };
}

// Default address first, then the most recently added
function listOf(user) {
  const newestFirst = user.addresses.map((a) => a.toObject()).reverse();
  return newestFirst.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)); // stable sort
}

function ensureOneDefault(user) {
  if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) user.addresses[0].isDefault = true;
}

export async function listAddresses(userId) {
  return listOf(await loadUser(userId));
}

export async function addAddress(userId, body) {
  const user = await loadUser(userId);
  if (user.addresses.length >= MAX_ADDRESSES) {
    throw new HttpError(400, `You can save up to ${MAX_ADDRESSES} addresses. Please delete one first.`);
  }
  const address = cleanAddress(body);
  const makeDefault = body.isDefault === true || !user.addresses.length;
  if (makeDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push({ ...address, isDefault: makeDefault });
  await user.save();
  return listOf(user);
}

function findAddress(user, addressId) {
  const address = user.addresses.id(requireObjectId(addressId, 'We couldn’t find that address.'));
  if (!address) throw new HttpError(404, 'We couldn’t find that address. It may have been deleted.');
  return address;
}

export async function updateAddress(userId, addressId, body) {
  const user = await loadUser(userId);
  const address = findAddress(user, addressId);
  // Optional fields left blank are cleared (cleanAddress returns undefined for them)
  address.set(cleanAddress(body));
  if (body.isDefault === true) {
    user.addresses.forEach((a) => { a.isDefault = false; });
    address.isDefault = true;
  }
  ensureOneDefault(user);
  await user.save();
  return listOf(user);
}

export async function setDefaultAddress(userId, addressId) {
  const user = await loadUser(userId);
  const address = findAddress(user, addressId);
  user.addresses.forEach((a) => { a.isDefault = false; });
  address.isDefault = true;
  await user.save();
  return listOf(user);
}

export async function deleteAddress(userId, addressId) {
  const user = await loadUser(userId);
  findAddress(user, addressId).deleteOne();
  ensureOneDefault(user);
  await user.save();
  return listOf(user);
}

// ---------- Delete my account (DPDP Act right to erasure) ----------
// Orders still on their way (or with an open return) must finish first, so we
// can deliver or refund them. Order and payment records are kept afterwards
// because tax and consumer laws require it (Privacy Policy §6).
const ORDERS_IN_PROGRESS = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'return_requested', 'return_approved'];

export async function deleteAccount(userId, { password, confirmText, reason }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Please log in again.');
  if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
    throw new HttpError(400, 'Please type DELETE to confirm.');
  }
  if (!(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    throw new HttpError(400, 'Your password is incorrect.');
  }
  const inProgress = await Order.countDocuments({ user: user._id, status: { $in: ORDERS_IN_PROGRESS } });
  if (inProgress) {
    throw new HttpError(409, `You have ${inProgress} order${inProgress === 1 ? '' : 's'} still in progress. You can delete your account once ${inProgress === 1 ? 'it is' : 'they are'} delivered or closed, or contact us for help.`);
  }

  const [{ store }, ordersKept] = await Promise.all([getSettings(), Order.countDocuments({ user: user._id })]);
  // Confirmation goes out before the email address is erased (never blocks deletion)
  await sendEmail({
    event: 'account_deleted',
    to: user.email,
    subject: `Your ${store.name} account has been deleted`,
    text: `Hi ${user.name},\n\nAs you asked, we have deleted your ${store.name} account and the personal data in it (profile, saved addresses, wishlist and cart).\n\n${ordersKept ? `Records of your ${ordersKept} past order(s) are kept only for as long as tax and consumer laws require, as explained in our Privacy Policy.\n\n` : ''}If you didn't ask for this, please contact us right away at ${store.email} or ${store.phone}.`,
  }).catch(() => {});

  await Promise.all([
    Cart.deleteMany({ user: user._id }),
    // Unpaid online orders never placed are not legal records: remove them
    Order.deleteMany({ user: user._id, status: 'pending_payment' }),
  ]);
  await User.deleteOne({ _id: user._id });
  await DeletionLog.create({ user: user._id, requestedBy: 'customer', reason: cleanText(reason, 300) || undefined, ordersKept });
  return { deleted: true, ordersKept };
}
