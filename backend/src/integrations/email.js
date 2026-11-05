// Transactional email (PRD §12.2). Every message is recorded in the
// Notification Log. Sending never throws: a failed email must never block an
// account action or an order (CLAUDE.md).
//
// Until an email service is connected (Phase 7: EMAIL_FROM + SMTP_* in
// backend/.env), the "log" driver only writes the message to the server log.
import { isProduction } from '../config/env.js';
import { NotificationLog } from '../models/index.js';

export const EMAIL_CONNECTED = Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);

async function deliver(message) {
  // The real provider is added in Phase 7
  console.log(`\n[email not sent: no email service connected yet]\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}\n`);
  return { delivered: false, note: 'No email service connected yet; message written to the server log.' };
}

export async function sendEmail({ to, subject, text, event }) {
  let log;
  try {
    log = await NotificationLog.create({ event, channel: 'email', recipient: to, status: 'queued' });
    const result = await deliver({ to, subject, text });
    await NotificationLog.updateOne(
      { _id: log._id },
      { status: result.delivered ? 'sent' : 'queued', attempts: 1, error: result.delivered ? undefined : result.note },
    );
    return result;
  } catch (err) {
    console.error(`Email "${event}" to ${to} failed`, err);
    if (log) await NotificationLog.updateOne({ _id: log._id }, { status: 'failed', attempts: 1, error: String(err.message || err) }).catch(() => {});
    return { delivered: false, note: 'Email failed' };
  }
}

// In development only, links that would be emailed are also handed back to
// the website, so flows like "Forgot password" can be tested without email
export const SHOW_EMAIL_LINKS_ON_SCREEN = !isProduction && !EMAIL_CONNECTED;
