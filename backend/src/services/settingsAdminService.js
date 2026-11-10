import { EMAIL_CONNECTED } from '../integrations/email.js';
import { publicKeyId, razorpayConfigured, razorpayMode } from '../integrations/razorpay.js';
import { Setting } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { cleanMediaUrl, cleanText } from '../utils/text.js';
import { cleanEmail } from './customerAuthService.js';
import { currentLegalVersion, getSettings } from './settingsService.js';

export { currentLegalVersion };

// Business Settings editing (PRD §14.11). Every value is checked here; anything
// not listed is ignored. Secrets (Razorpay, email, SMS) stay in backend/.env.

// Emails the owner can switch off one by one (security emails can't be switched off)
export const EMAIL_EVENTS = {
  customer: {
    account_registered: 'Welcome email after registering',
    order_confirmed: 'Order confirmed',
    payment_failed: 'Payment failed – complete your payment',
    order_processing: 'Order being packed',
    order_shipped: 'Order shipped (with tracking)',
    order_out_for_delivery: 'Out for delivery',
    order_delivered: 'Delivered',
    order_delivery_failed: 'Delivery unsuccessful',
    order_cancelled: 'Order cancelled',
    refund_processed: 'Refund processed',
    return_requested: 'Return/exchange request received',
    return_approved: 'Return approved',
    return_rejected: 'Return rejected',
    return_pickup_scheduled: 'Return pickup arranged',
    return_received: 'Returned item received',
    return_replacement_shipped: 'Replacement shipped',
    review_reminder: 'Review reminder (3 days after delivery)',
    review_approved: 'Review published',
    review_replied: 'You replied to their review',
    contact_received: 'Copy of their contact message',
    newsletter_subscribed: 'Newsletter sign-up confirmation',
  },
  admin: {
    order_confirmed_admin: 'New order',
    order_cancelled_admin: 'Order cancelled',
    return_requested_admin: 'New return/exchange request',
    review_submitted_admin: 'New review to approve',
    contact_received_admin: 'New contact message',
    low_stock_daily_admin: 'Daily stock alert',
  },
};
const ALL_EVENTS = new Set([...Object.keys(EMAIL_EVENTS.customer), ...Object.keys(EMAIL_EVENTS.admin)]);

const PAGES = ['about', 'privacy', 'terms', 'shipping', 'refunds', 'faq'];
const POLICY_PAGES = ['privacy', 'terms', 'refunds'];

function money(value, label, { min = 0, max = 1000000 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || Math.round(n) !== n) throw new HttpError(400, `${label}: please enter a whole number from ${min.toLocaleString('en-IN')} to ${max.toLocaleString('en-IN')}.`);
  return n;
}

function https(value, label) {
  const v = cleanText(value, 500);
  if (!v) return '';
  if (!/^https:\/\/[^\s]+$/i.test(v)) throw new HttpError(400, `${label}: please paste a full link starting with https://`);
  return v;
}

function text(value, label, { max = 200, required = false } = {}) {
  const v = cleanText(value, max + 1);
  if (required && !v) throw new HttpError(400, `Please enter the ${label.toLowerCase()}.`);
  if (v.length > max) throw new HttpError(400, `${label}: please keep it to ${max} characters.`);
  return v;
}

// What the settings screen shows (current values plus read-only status)
export async function getSettingsForAdmin() {
  const s = await getSettings();
  const keyId = publicKeyId();
  return {
    store: s.store,
    delivery: s.delivery,
    cod: s.cod,
    orders: s.orders,
    notifications: { ...s.notifications, events: s.notifications.events || {} },
    social: s.social,
    seo: s.seo,
    pages: Object.fromEntries(PAGES.map((p) => [p, s.pages?.[p] || ''])),
    legalVersion: await currentLegalVersion(),
    emailEvents: EMAIL_EVENTS,
    status: {
      razorpay: { connected: razorpayConfigured(), mode: razorpayConfigured() ? razorpayMode() : null, keyId: keyId ? `${keyId.slice(0, 9)}••••${keyId.slice(-4)}` : '' },
      email: { connected: EMAIL_CONNECTED },
    },
  };
}

/** Saves one section: store, delivery, cod, orders, notifications, social, seo or pages. */
export async function saveSettingsSection(section, body = {}) {
  const set = {};
  switch (section) {
    case 'store': {
      Object.assign(set, {
        'values.store.name': text(body.name, 'Store name', { max: 60, required: true }),
        'values.store.tagline': text(body.tagline, 'Tagline', { max: 120 }),
        'values.store.logoUrl': cleanMediaUrl(body.logoUrl),
        'values.store.faviconUrl': cleanMediaUrl(body.faviconUrl),
        'values.store.email': cleanEmail(body.email),
        'values.store.phone': text(body.phone, 'Phone', { max: 20, required: true }),
        'values.store.address': text(body.address, 'Address', { max: 300, required: true }),
        'values.store.businessHours': text(body.businessHours, 'Business hours', { max: 80 }),
        'values.store.mapLink': https(body.mapLink, 'Google Maps link'),
        'values.store.mapQuery': text(body.mapQuery, 'Map search text', { max: 200 }),
      });
      const wa = String(body.whatsappNumber || '').replace(/\D/g, '');
      if (wa && !/^91[6-9]\d{9}$/.test(wa)) throw new HttpError(400, 'WhatsApp number: use 91 followed by the 10-digit mobile number, e.g. 919876543210.');
      set['values.store.whatsappNumber'] = wa;
      const embed = cleanText(body.mapEmbedUrl, 2000);
      if (embed && !/^https:\/\/www\.google\.com\/maps\/embed\?/.test(embed)) throw new HttpError(400, 'Map embed: paste the link from Google Maps → Share → Embed a map (it starts with https://www.google.com/maps/embed?).');
      set['values.store.mapEmbedUrl'] = embed;
      break;
    }
    case 'delivery': {
      const min = money(body.estimateMinDays, 'Delivery estimate (from)', { min: 1, max: 60 });
      const max = money(body.estimateMaxDays, 'Delivery estimate (to)', { min: 1, max: 90 });
      if (max < min) throw new HttpError(400, 'The delivery estimate “to” must be the same as or more than “from”.');
      Object.assign(set, {
        'values.delivery.freeDeliveryThreshold': money(body.freeDeliveryThreshold, 'Free delivery from', { max: 100000 }),
        'values.delivery.deliveryCharge': money(body.deliveryCharge, 'Delivery charge', { max: 5000 }),
        'values.delivery.estimateMinDays': min,
        'values.delivery.estimateMaxDays': max,
      });
      break;
    }
    case 'cod':
      Object.assign(set, {
        'values.cod.enabled': body.enabled === true,
        'values.cod.charge': money(body.charge, 'COD charge', { max: 5000 }),
        'values.cod.maxOrderValue': money(body.maxOrderValue, 'Maximum COD order', { min: 1, max: 1000000 }),
      });
      break;
    case 'orders':
      Object.assign(set, {
        'values.orders.maxQtyPerItem': money(body.maxQtyPerItem, 'Max quantity per item', { min: 1, max: 50 }),
        'values.orders.returnWindowDays': money(body.returnWindowDays, 'Return window', { max: 60 }),
        'values.orders.newArrivalDays': money(body.newArrivalDays, 'New arrival period', { min: 1, max: 365 }),
        'values.orders.lowStockDefault': money(body.lowStockDefault, 'Low-stock level', { max: 1000 }),
      });
      break;
    case 'notifications': {
      const events = {};
      for (const [key, on] of Object.entries(body.events || {})) if (ALL_EVENTS.has(key)) events[key] = on !== false;
      Object.assign(set, {
        'values.notifications.adminAlertEmail': body.adminAlertEmail ? cleanEmail(body.adminAlertEmail) : '',
        'values.notifications.emailEnabled': body.emailEnabled !== false,
        'values.notifications.events': events,
      });
      break;
    }
    case 'social':
      for (const key of ['instagram', 'facebook', 'youtube', 'x', 'pinterest']) set[`values.social.${key}`] = https(body[key], key === 'x' ? 'X (Twitter)' : key[0].toUpperCase() + key.slice(1));
      break;
    case 'seo':
      Object.assign(set, {
        'values.seo.title': text(body.title, 'Site title', { max: 70, required: true }),
        'values.seo.description': text(body.description, 'Site description', { max: 200, required: true }),
        'values.seo.shareImageUrl': cleanMediaUrl(body.shareImageUrl),
      });
      break;
    case 'pages': {
      const name = body.page;
      if (!PAGES.includes(name)) throw new HttpError(400, 'Please choose a page.');
      const content = String(body.content ?? '').replace(/\r\n/g, '\n').trim();
      if (content.length < 20) throw new HttpError(400, 'This page looks empty. Please add the text.');
      if (content.length > 60000) throw new HttpError(400, 'This page is too long (60,000 characters at most).');
      set[`pages.${name}`] = content;
      // A changed policy is a new version: new consents record it (DPDP)
      if (POLICY_PAGES.includes(name)) set['values.legalVersion'] = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      break;
    }
    default:
      throw new HttpError(404, 'We couldn’t find that settings section.');
  }
  await Setting.updateOne({ key: 'business' }, { $set: set }, { upsert: true });
  return getSettingsForAdmin();
}
