// NetworkZ Systems SMS gateway (https://message.networkzsystems.com), used for OTPs.
// API v1.0: POST {base}/send-sms, form-urlencoded, signed with MD5:
//   TimeKey            = MD5(requestFor + "sms@rits-v1.0" + expire)
//   TimeAccessTokenKey = MD5(accessToken + TimeKey)
//   authSignature      = MD5(TimeAccessTokenKey + accessTokenKey)
// Indian DLT rules: the message must match the approved template word for word,
// sent with the registered entity ID, template ID and header (sender ID).
// Credentials come only from backend/.env. Message text and OTPs are never logged.
import crypto from 'node:crypto';
import { NotificationLog } from '../models/index.js';

const md5 = (text) => crypto.createHash('md5').update(text).digest('hex');

export function smsConfig() {
  return {
    base: (process.env.SMS_API_BASE || 'https://message.networkzsystems.com/api/sms/v1.0').replace(/\/+$/, ''),
    accessToken: process.env.SMS_ACCESS_TOKEN || '',
    accessTokenKey: process.env.SMS_ACCESS_TOKEN_KEY || '',
    entityId: process.env.SMS_ENTITY_ID || '',
    header: process.env.SMS_HEADER || '',
    templateId: process.env.SMS_TEMPLATE_ID || '',
    otpTemplate: process.env.SMS_OTP_TEMPLATE || '',
    route: process.env.SMS_ROUTE || 'transactional',
  };
}

// Everything needed to send a real, DLT-compliant OTP SMS
export function smsConfigured() {
  const c = smsConfig();
  return Boolean(c.accessToken && c.accessTokenKey && c.entityId && c.header && c.templateId && c.otpTemplate.includes('{#var#}'));
}

export function signRequest(requestFor, expire, { accessToken, accessTokenKey } = smsConfig()) {
  const timeKey = md5(`${requestFor}sms@rits-v1.0${expire}`);
  const timeAccessTokenKey = md5(`${accessToken}${timeKey}`);
  return md5(`${timeAccessTokenKey}${accessTokenKey}`);
}

// Fills the DLT template's {#var#} with the OTP
export function otpMessage(code, template = smsConfig().otpTemplate) {
  return template.replace('{#var#}', code);
}

// The gateway's error codes, in words a shopper understands (details go to the log)
const FRIENDLY = {
  402: 'SMS service is temporarily unavailable. Please try again later.',
  403: 'SMS service is temporarily unavailable. Please try again later.',
  409: 'We couldn’t send the SMS. Please try again later.',
  413: 'Too many SMS requests right now. Please try again in a few minutes.',
};

/**
 * Sends one SMS to a 10-digit Indian mobile number.
 * Returns { ok: true, submissionId } or { ok: false, status, reason }. Never throws.
 */
export async function sendSms({ mobile, message, event = 'otp' }) {
  const c = smsConfig();
  const expire = Math.floor(Date.now() / 1000) + 60; // signature valid for 1 minute
  const body = new URLSearchParams({
    accessToken: c.accessToken,
    expire: String(expire),
    authSignature: signRequest('send-sms', expire, c),
    route: c.route,
    smsHeader: c.header,
    messageContent: message,
    recipients: mobile,
    contentType: 'text',
    entityId: c.entityId,
    templateId: c.templateId,
    removeDuplicateNumbers: '1',
  });
  let log;
  try {
    log = await NotificationLog.create({ event, channel: 'sms', recipient: mobile, status: 'queued' });
    const response = await fetch(`${c.base}/send-sms`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    const status = Number(data.httpStatusCode || response.status);
    if (response.ok && data.status === 'success') {
      await NotificationLog.updateOne({ _id: log._id }, { status: 'sent', attempts: 1 });
      return { ok: true, submissionId: data.data?.submissionId };
    }
    const reason = `${status} ${data.message || 'SMS gateway error'}`;
    console.error(`SMS to ${mobile.slice(0, 2)}******${mobile.slice(-2)} failed: ${reason}`);
    await NotificationLog.updateOne({ _id: log._id }, { status: 'failed', attempts: 1, error: reason });
    return { ok: false, status, reason, friendly: FRIENDLY[status] || 'We couldn’t send the SMS. Please try again in a moment.' };
  } catch (err) {
    console.error('SMS gateway unreachable', err.message);
    if (log) await NotificationLog.updateOne({ _id: log._id }, { status: 'failed', attempts: 1, error: String(err.message || err) }).catch(() => {});
    return { ok: false, status: 0, reason: err.message, friendly: 'We couldn’t send the SMS. Please check your number and try again.' };
  }
}
