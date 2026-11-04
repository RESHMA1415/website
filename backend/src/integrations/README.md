# Integrations

Outside services. Each file is added in its build phase (PRD §21):

| File | Service | Phase |
|---|---|---|
| `razorpay.js` | Razorpay orders, signature check, webhooks, refunds | 4 |
| `email.js` | Transactional email | 7 |
| `whatsapp.js` | WhatsApp Cloud API template messages | 7 |
| `media.js` | Image/video upload and resizing | 2 |

Keys come from `backend/.env` only.
