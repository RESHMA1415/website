// Transactional email (PRD §12.2). Every message is recorded in the
// Notification Log. Sending never throws: a failed email must never block an
// account action or an order (CLAUDE.md). Failed sends are retried.
//
// Sending uses SMTP through Nodemailer. At launch this is the owner's Gmail
// (an App Password, not the normal password), set only in backend/.env:
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_SECURE=true
//   SMTP_USER=…@gmail.com  SMTP_PASS=<16-letter app password>
//   EMAIL_FROM="SHOPME <…@gmail.com>"  (EMAIL_REPLY_TO optional)
// Without these the "log" driver only writes the message to the server log.
import nodemailer from 'nodemailer';
import { isProduction } from '../config/env.js';
import { NotificationLog } from '../models/index.js';
import { getSettings } from '../services/settingsService.js';

const smtp = () => ({
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: String(process.env.SMTP_SECURE ?? 'true') !== 'false',
  user: process.env.SMTP_USER || '',
  pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''), // Google shows app passwords in groups of 4
  from: process.env.EMAIL_FROM || '',
  replyTo: process.env.EMAIL_REPLY_TO || '',
});

export const EMAIL_CONNECTED = (() => {
  const c = smtp();
  return Boolean(c.host && c.user && c.pass && c.from);
})();

// In development only, links that would be emailed are also handed back to
// the website, so flows like "Forgot password" can be tested without email
export const SHOW_EMAIL_LINKS_ON_SCREEN = !isProduction && !EMAIL_CONNECTED;

// Messages people need even if the owner switches emails off (security and legal)
const ESSENTIAL = new Set(['password_reset', 'account_deleted', 'email_test', 'admin_login_code', 'backup_failed']);
export const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = [5, 30]; // wait before the 2nd and 3rd try

let transport;
function getTransport() {
  if (!transport) {
    const c = smtp();
    transport = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
      connectionTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transport;
}

// ---------- The SHOPME email design ----------
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NAVY = '#14213D';
const ORANGE = '#FF7A00';

function linkify(line) {
  return escapeHtml(line).replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" style="color:${ORANGE};word-break:break-all">${url}</a>`);
}

// Plain text → simple, safe HTML: paragraphs, "- " lists and clickable links
function textToHtml(text) {
  const blocks = String(text).trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^- /.test(l))) {
        return `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:0 0 4px">${linkify(l.slice(2))}</li>`).join('')}</ul>`;
      }
      return `<p style="margin:0 0 16px">${lines.map(linkify).join('<br>')}</p>`;
    })
    .join('');
}

export function renderEmail({ subject, text, action, store = {} }) {
  const button = action?.url
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(action.url)}" style="background:${ORANGE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block">${escapeHtml(action.label || 'Open')}</a></p>`
    : '';
  const contact = [store.phone && `Call or WhatsApp ${escapeHtml(store.phone)}`, store.email && escapeHtml(store.email)].filter(Boolean).join(' · ');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${NAVY};padding:18px 24px;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff">SHOP<span style="color:${ORANGE}">ME</span></td></tr>
<tr><td style="padding:28px 24px 8px;font-size:15px;line-height:1.6">${textToHtml(text)}${button}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #eef0f4;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(store.name || 'SHOPME')}${store.address ? ` · ${escapeHtml(store.address)}` : ''}${contact ? `<br>${contact}` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

async function storeAndSwitch() {
  const settings = await getSettings();
  return { store: settings.store || {}, notifications: settings.notifications || {} };
}

async function deliver({ to, subject, text, html }) {
  if (!EMAIL_CONNECTED) {
    console.log(`\n[email not sent: no email service connected yet]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return { delivered: false, logged: true };
  }
  const c = smtp();
  const info = await getTransport().sendMail({ from: c.from, replyTo: c.replyTo || undefined, to, subject, text, html });
  return { delivered: true, messageId: info.messageId };
}

/**
 * Sends one email. `action` = { label, url } adds a button. Returns
 * { delivered, logged?, skipped?, failed? }. Never throws.
 */
export async function sendEmail({ to, subject, text, event, action, order }) {
  let log;
  try {
    const { store, notifications } = await storeAndSwitch();
    const switchedOff = notifications.emailEnabled === false ? 'Emails are switched off in Business Settings' : notifications.events?.[event] === false ? 'This email is switched off in Business Settings' : '';
    if (switchedOff && !ESSENTIAL.has(event)) {
      await NotificationLog.create({ event, channel: 'email', recipient: to, order, status: 'skipped', error: switchedOff });
      return { delivered: false, skipped: true };
    }
    const html = renderEmail({ subject, text, action, store });
    log = await NotificationLog.create({ event, channel: 'email', recipient: to, order, status: 'queued' });
    const result = await deliver({ to, subject, text, html });
    await NotificationLog.updateOne(
      { _id: log._id },
      result.delivered
        ? { status: 'sent', attempts: 1, sentAt: new Date(), messageId: result.messageId }
        : { status: 'logged', attempts: 1, error: 'No email service connected yet; message written to the server log.' },
    );
    return result;
  } catch (err) {
    console.error(`Email "${event}" to ${to} failed: ${err.message}`);
    if (log) {
      // Keep the message for a retry; it is removed again once sent or given up
      const { store } = await storeAndSwitch().catch(() => ({ store: {} }));
      await NotificationLog.updateOne(
        { _id: log._id },
        {
          status: 'failed',
          attempts: 1,
          error: String(err.message || err).slice(0, 300),
          nextAttemptAt: new Date(Date.now() + RETRY_MINUTES[0] * 60000),
          payload: { subject, text, html: renderEmail({ subject, text, action, store }) },
        },
      ).catch(() => {});
    }
    return { delivered: false, failed: true };
  }
}

// Tries failed emails again (called every few minutes from server.js)
export async function retryFailedEmails(now = new Date()) {
  if (!EMAIL_CONNECTED) return 0;
  const due = await NotificationLog.find({ channel: 'email', status: 'failed', attempts: { $lt: MAX_ATTEMPTS }, nextAttemptAt: { $lte: now } })
    .select('+payload')
    .limit(50)
    .lean();
  let sent = 0;
  for (const row of due) {
    if (!row.payload) continue;
    // Claim it so two servers never resend the same email
    const claimed = await NotificationLog.findOneAndUpdate({ _id: row._id, status: 'failed', attempts: row.attempts }, { status: 'queued' });
    if (!claimed) continue;
    const attempts = row.attempts + 1;
    try {
      const result = await deliver({ to: row.recipient, ...row.payload });
      await NotificationLog.updateOne({ _id: row._id }, { status: 'sent', attempts, sentAt: new Date(), messageId: result.messageId, $unset: { payload: 1, error: 1, nextAttemptAt: 1 } });
      sent += 1;
    } catch (err) {
      const giveUp = attempts >= MAX_ATTEMPTS;
      await NotificationLog.updateOne(
        { _id: row._id },
        {
          status: 'failed',
          attempts,
          error: String(err.message || err).slice(0, 300),
          ...(giveUp ? { $unset: { payload: 1, nextAttemptAt: 1 } } : { nextAttemptAt: new Date(Date.now() + RETRY_MINUTES[attempts - 1] * 60000) }),
        },
      );
    }
  }
  return sent;
}

// Connection check for the admin's "Send test email" button
export async function verifyEmailConnection() {
  if (!EMAIL_CONNECTED) return { connected: false, reason: 'Email isn’t set up yet: add the Gmail details to backend/.env and restart.' };
  try {
    await getTransport().verify();
    return { connected: true, from: smtp().from };
  } catch (err) {
    const reason = /Invalid login|535|Username and Password not accepted/i.test(err.message)
      ? 'Gmail refused the login. Check SMTP_USER and that SMTP_PASS is a Google App Password (not your normal password).'
      : `Couldn’t reach the email server: ${err.message}`;
    return { connected: false, reason };
  }
}
