import mongoose from 'mongoose';
import { HttpError } from './asyncHandler.js';

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\(sample\)/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Trimmed string or '' (never undefined/objects), cut to `max` characters
export function cleanText(value, max = 500) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().slice(0, max);
}

export function requireText(value, label, max = 500) {
  const text = cleanText(value, max);
  if (!text) throw new HttpError(400, `Please enter the ${label}.`);
  return text;
}

// Whole rupees / counts. Returns undefined when blank and `optional`.
export function toWholeNumber(value, label, { min = 0, max = 10_000_000, optional = false } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (optional) return undefined;
    throw new HttpError(400, `Please enter the ${label}.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `The ${label} must be a whole number between ${min} and ${max.toLocaleString('en-IN')}.`);
  }
  return number;
}

export function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);
}

export function requireObjectId(value, message = 'We couldn’t find that item.') {
  if (!isObjectId(String(value || ''))) throw new HttpError(404, message);
  return String(value);
}

export function pageParams(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Only site-relative links (e.g. /women) or full http(s) addresses
export function cleanLink(value) {
  const link = cleanText(value, 300);
  if (!link) return '';
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  if (/^https?:\/\//i.test(link)) return link;
  throw new HttpError(400, 'Links must start with / (a page on your store) or https://');
}

// Media URLs must come from our own uploads (or https for an external host)
export function cleanMediaUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return '';
  if (url.startsWith('/uploads/') || /^https:\/\//i.test(url)) return url;
  throw new HttpError(400, 'Please choose the photo from the Media Library.');
}
