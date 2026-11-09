import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { LEGAL_VERSION } from '../content/legal/index.js';
import { sendEmail } from '../integrations/email.js';
import { ContactMessage, Counter, NewsletterSubscriber } from '../models/index.js';
import { HttpError } from '../utils/asyncHandler.js';
import { normaliseMobile } from '../utils/india.js';
import { cleanText, escapeRegex, pageParams, requireObjectId } from '../utils/text.js';
import { cleanEmail, cleanMobile } from './customerAuthService.js';
import { listInventory } from './inventoryService.js';
import { getSettings } from './settingsService.js';

// Contact Us inbox (PRD §13.13, §14.12), newsletter sign-ups (PRD §13.1) and the
// daily low-stock alert (PRD §12.2). Emails never block the action.

const SUBJECTS = { order_issue: 'Order issue', return: 'Return or exchange', product_question: 'Product question', other: 'Other' };
export const SUBJECT_LABELS = SUBJECTS;

// Small per-connection limits so forms can't be used to spam the owner's inbox
const hits = new Map();
function limit(kind, ip, max, minutes) {
  if (!ip) return;
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < minutes * 60000);
  if (recent.length >= max) throw new HttpError(429, 'You’ve sent a lot of requests. Please try again a little later.');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}

const fire = (task) => Promise.resolve().then(task).catch((err) => console.error('Message email failed', err));

// ---------- Contact Us ----------
export async function submitContact(body = {}, { ip, userId } = {}) {
  if (body.agree !== true) throw new HttpError(400, 'Please tick the box to agree to how we use your details.');
  const name = cleanText(body.name, 80);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.');
  const email = cleanEmail(body.email);
  const mobile = body.mobile ? cleanMobile(body.mobile) : undefined;
  const orderNumber = cleanText(body.orderNumber, 30).toUpperCase() || undefined;
  if (orderNumber && !/^SHM-\d{6}-\d{4}$/.test(orderNumber)) throw new HttpError(400, 'Order numbers look like SHM-261103-0042. Please check it, or leave it empty.');
  if (!SUBJECTS[body.subject]) throw new HttpError(400, 'Please choose a topic.');
  const message = cleanText(body.message, 2000);
  if (message.length < 10) throw new HttpError(400, 'Please write a little more so we can help (at least 10 characters).');
  limit('contact', ip, 5, 60);

  const saved = await ContactMessage.create({
    name, email, mobile, orderNumber, subject: body.subject, message, user: userId,
    consent: { acceptedAt: new Date(), policyVersion: LEGAL_VERSION },
  });
  const settings = await getSettings();
  fire(() =>
    sendEmail({
      event: 'contact_received',
      to: email,
      subject: `We received your message – ${settings.store.name}`,
      text: `Hi ${name},\n\nThanks for contacting ${settings.store.name}. We've received your message about "${SUBJECTS[body.subject]}"${orderNumber ? ` (order ${orderNumber})` : ''} and will reply within one business day.\n\nYour message:\n${message}\n\nFor anything urgent, call or WhatsApp us on ${settings.store.phone}.`,
    }),
  );
  if (settings.notifications?.adminAlertEmail) {
    fire(() =>
      sendEmail({
        event: 'contact_received_admin',
        to: settings.notifications.adminAlertEmail,
        subject: `New message: ${SUBJECTS[body.subject]} from ${name}`,
        text: `${name} (${email}${mobile ? `, ${mobile}` : ''}) sent a message${orderNumber ? ` about order ${orderNumber}` : ''}:\n\n${message}\n\nReply to them by email, then mark it Replied in Contact Messages.`,
        action: { label: 'Open Contact Messages', url: `${env.adminUrl}/messages` },
      }),
    );
  }
  return { id: saved._id, received: true };
}

const TABS = { new: ['new'], replied: ['replied'], closed: ['closed'] };

export async function listMessagesForAdmin(query = {}) {
  const tab = TABS[query.tab] ? query.tab : 'new';
  const filter = { status: { $in: TABS[tab] } };
  const q = cleanText(query.q, 80);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { mobile: pattern }, { orderNumber: pattern }, { message: pattern }];
  }
  const { page, limit: perPage, skip } = pageParams(query, { defaultLimit: 25, maxLimit: 100 });
  const [items, total, byStatus] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: tab === 'new' ? 1 : -1 }).skip(skip).limit(perPage).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  return {
    items: items.map((m) => ({ ...m, subjectLabel: SUBJECTS[m.subject] || m.subject })),
    total,
    page,
    pages: Math.ceil(total / perPage),
    counts: Object.fromEntries(Object.keys(TABS).map((k) => [k, byStatus.find((s) => s._id === k)?.n || 0])),
  };
}

export async function updateMessage(id, body = {}) {
  const update = {};
  if (body.status) {
    if (!TABS[body.status]) throw new HttpError(400, 'Please choose New, Replied or Closed.');
    update.status = body.status;
    if (body.status === 'replied') update.repliedAt = new Date();
  }
  if (body.adminNote !== undefined) update.adminNote = cleanText(body.adminNote, 1000);
  const message = await ContactMessage.findByIdAndUpdate(requireObjectId(id, 'We couldn’t find that message.'), update, { new: true }).lean();
  if (!message) throw new HttpError(404, 'We couldn’t find that message.');
  return { ...message, subjectLabel: SUBJECTS[message.subject] || message.subject };
}

export async function newMessageCount() {
  return { new: await ContactMessage.countDocuments({ status: 'new' }) };
}

// ---------- Newsletter ----------
const unsubscribeToken = (id) => crypto.createHmac('sha256', env.jwtSecret).update(`newsletter:${id}`).digest('hex').slice(0, 32);
const unsubscribeLink = (sub) => `${env.storeUrl}/newsletter/unsubscribe?id=${sub._id}&t=${unsubscribeToken(sub._id)}`;

export async function subscribeNewsletter(body = {}, { ip } = {}) {
  if (body.agree !== true) throw new HttpError(400, 'Please tick the box to agree to receive updates.');
  const contact = cleanText(body.contact, 120);
  if (!contact) throw new HttpError(400, 'Please enter your email or WhatsApp number.');
  let email;
  let mobile;
  if (contact.includes('@')) email = cleanEmail(contact);
  else {
    mobile = normaliseMobile(contact);
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new HttpError(400, 'Please enter a valid email or 10-digit mobile number.');
  }
  limit('newsletter', ip, 10, 60);
  const filter = email ? { email } : { mobile };
  const existing = await NewsletterSubscriber.findOne(filter);
  if (existing?.status === 'subscribed') return { subscribed: true, already: true };
  const consent = { acceptedAt: new Date(), policyVersion: LEGAL_VERSION };
  let sub;
  try {
    sub = existing
      ? await NewsletterSubscriber.findByIdAndUpdate(existing._id, { status: 'subscribed', consent, $unset: { unsubscribedAt: 1 } }, { new: true })
      : await NewsletterSubscriber.create({ ...filter, consent, source: cleanText(body.source, 30) || 'homepage' });
  } catch (err) {
    if (err.code === 11000) return { subscribed: true, already: true };
    throw err;
  }
  if (email) {
    const settings = await getSettings();
    fire(() =>
      sendEmail({
        event: 'newsletter_subscribed',
        to: email,
        subject: `You're subscribed to ${settings.store.name} updates`,
        text: `Thanks for signing up! You'll hear about new arrivals and offers from ${settings.store.name}.\n\nChanged your mind? Unsubscribe any time: ${unsubscribeLink(sub)}`,
        action: { label: 'Shop new arrivals', url: `${env.storeUrl}/new-arrivals` },
      }),
    );
  }
  return { subscribed: true };
}

export async function unsubscribeNewsletter(body = {}) {
  const id = String(body.id || '');
  const token = String(body.t || '');
  if (!/^[a-f0-9]{24}$/i.test(id) || token.length !== 32) throw new HttpError(400, 'This unsubscribe link isn’t valid.');
  const expected = unsubscribeToken(id);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) throw new HttpError(400, 'This unsubscribe link isn’t valid.');
  const sub = await NewsletterSubscriber.findByIdAndUpdate(id, { status: 'unsubscribed', unsubscribedAt: new Date() }, { new: true });
  if (!sub) throw new HttpError(404, 'You’re not on our list any more.');
  return { unsubscribed: true };
}

export async function listSubscribersForAdmin(query = {}) {
  const status = query.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed';
  const filter = { status };
  const q = cleanText(query.q, 80);
  if (q) filter.$or = [{ email: new RegExp(escapeRegex(q), 'i') }, { mobile: new RegExp(escapeRegex(q), 'i') }];
  const { page, limit: perPage, skip } = pageParams(query, { defaultLimit: 50, maxLimit: 200 });
  const [items, total, subscribed] = await Promise.all([
    NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    NewsletterSubscriber.countDocuments(filter),
    NewsletterSubscriber.countDocuments({ status: 'subscribed' }),
  ]);
  return { items, total, page, pages: Math.ceil(total / perPage), subscribed };
}

export async function exportSubscribersCsv() {
  const rows = await NewsletterSubscriber.find({ status: 'subscribed' }).sort({ createdAt: -1 }).lean();
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['Email,Mobile,Signed up,Source', ...rows.map((r) => [r.email, r.mobile, r.createdAt?.toISOString().slice(0, 10), r.source].map(cell).join(','))].join('\n');
}

// ---------- Daily low-stock summary (once a day, after 9 AM India time) ----------
function indiaNow(date = new Date()) {
  return new Date(date.getTime() + 5.5 * 3600 * 1000);
}

export async function sendLowStockSummary(now = new Date()) {
  const ist = indiaNow(now);
  if (ist.getUTCHours() < 9) return { sent: false, reason: 'before 9 AM' };
  const settings = await getSettings();
  if (!settings.notifications?.adminAlertEmail) return { sent: false, reason: 'no admin email' };
  const dayKey = `lowstock-${ist.toISOString().slice(0, 10)}`;
  // Claim today's summary first so it is sent once even with several servers
  try {
    await Counter.create({ _id: dayKey, seq: 1 });
  } catch (err) {
    if (err.code === 11000) return { sent: false, reason: 'already sent today' };
    throw err;
  }
  const [out, low] = await Promise.all([listInventory({ stock: 'out', limit: 100 }), listInventory({ stock: 'low', limit: 100 })]);
  if (!out.total && !low.total) return { sent: false, reason: 'nothing low' };
  const line = (r) => `- ${r.productName} (${r.optionLabel || r.sku}): ${r.stock} left`;
  const text = [
    `Good morning! Here is today's stock check for ${settings.store.name}.`,
    out.total ? `Sold out (${out.total}):\n${out.items.slice(0, 40).map(line).join('\n')}` : '',
    low.total ? `Running low (${low.total}):\n${low.items.slice(0, 40).map(line).join('\n')}` : '',
    'Update stock in Inventory when new stock arrives.',
  ].filter(Boolean).join('\n\n');
  await sendEmail({
    event: 'low_stock_daily_admin',
    to: settings.notifications.adminAlertEmail,
    subject: `Stock alert: ${out.total} sold out, ${low.total} running low`,
    text,
    action: { label: 'Open Inventory', url: `${env.adminUrl}/inventory` },
  });
  return { sent: true, out: out.total, low: low.total };
}
