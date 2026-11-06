# Integrations

Outside services. Each file is added in its build phase (PRD §21):

| File | Service | Phase |
|---|---|---|
| `razorpay.js` | Razorpay orders, payment check/capture, signatures (checkout + webhook), refunds | 4 (done) |
| `email.js` | Transactional email (log-only driver since Phase 3; real provider in Phase 7) | 3 / 7 |
| `whatsapp.js` | WhatsApp Cloud API template messages | 7 |
| `media.js` | Image/video upload and resizing | 2 |
| `sms.js` | NetworkZ Systems SMS gateway (API v1.0, MD5-signed) for 6-digit OTP login and registration. Until fully configured, codes appear on screen in development only | owner request (done) |

Keys come from `backend/.env` only.
