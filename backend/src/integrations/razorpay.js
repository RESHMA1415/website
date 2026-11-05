// Razorpay (PRD §9): orders, payment check, capture, refunds and webhook
// signatures. Keys come only from backend/.env. Card/UPI details never reach
// SHOPME; the Razorpay window handles them.
import crypto from 'node:crypto';

const API = 'https://api.razorpay.com/v1';

const keys = () => ({
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
});

export function razorpayConfigured() {
  const { keyId, keySecret } = keys();
  return Boolean(keyId && keySecret);
}

export function razorpayMode() {
  return keys().keyId.startsWith('rzp_live_') ? 'live' : 'test';
}

export function publicKeyId() {
  return keys().keyId;
}

async function call(method, path, body) {
  const { keyId, keySecret } = keys();
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.description || `Razorpay request failed (${response.status})`);
    error.razorpay = data?.error;
    error.status = response.status;
    throw error;
  }
  return data;
}

// Amounts are whole rupees in SHOPME and paise at Razorpay
export const toPaise = (rupees) => Math.round(rupees * 100);

export function createRazorpayOrder({ amount, receipt, notes }) {
  return call('POST', '/orders', { amount: toPaise(amount), currency: 'INR', receipt, notes });
}

export function fetchPayment(paymentId) {
  return call('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export function capturePayment(paymentId, amount) {
  return call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: toPaise(amount), currency: 'INR' });
}

export function refundPayment(paymentId, amount, notes) {
  return call('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: toPaise(amount), notes });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  const expected = crypto.createHmac('sha256', keys().keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

// Webhook: signature = HMAC_SHA256(raw request body, webhook secret)
export function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = keys();
  if (!webhookSecret) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

// Razorpay's method names → ours
export function paymentMethodName(method) {
  return ['upi', 'card', 'netbanking', 'wallet'].includes(method) ? method : 'other';
}
