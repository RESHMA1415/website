# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**SHOPME** is a clothing & women's fashion e-commerce web app for India (INR only). It has a customer website, a separate admin panel, and a backend API.

**`PRD.md` is the source of truth.** Read the relevant PRD section before building any feature. If code and PRD disagree, follow the PRD and flag the conflict. If the PRD is silent, ask; don't invent business rules.

## The owner

The owner is a **non-technical business owner**. When reporting to them:
- Use plain language. Explain what changed in business terms ("customers can now…"), not code terms.
- Ask before making decisions that change business behaviour (prices, fees, policies, what customers see).
- Point them to what they can click and check themselves.

## Tech stack

| Part | Tech |
|---|---|
| Customer site | React.js + Bootstrap + custom CSS |
| Admin panel | React.js (separate app) + Bootstrap + custom CSS |
| Backend | Node.js + Express.js (REST API) |
| Database | MongoDB (Mongoose) |
| Auth | JWT; separate auth for customers and admin |
| Payments | Razorpay (Checkout, Webhooks, Refunds) |
| Messaging | Email (transactional provider) + WhatsApp (click-to-chat link + Meta Cloud API templates) + SMS OTP (NetworkZ Systems gateway) |
| Media | Cloud storage with resizing (e.g. Cloudinary) |

Do not swap or add major libraries/frameworks without asking.

## Repository layout

```
/frontend   customer website (React + Vite), port 5173
/admin      admin panel (React + Vite, separate app), port 5174
/backend    Express API, port 5000
  src/config/        env, database connection, default Business Settings
  src/models/        Mongoose models (PRD §15)
  src/services/      business rules (pricing, settings, products)
  src/routes/        API routes, mounted under /api
  src/seed/          starter categories, banners, sample products
  src/integrations/  Razorpay, email, WhatsApp, media (added per phase)
tools/project-hub/  Project Hub artifact: hub-data.json (board data), template.html, build.mjs (npm run hub)
.claude/skills/     project skills (project-hub)
PRD.md      product requirements (source of truth)
CLAUDE.md   this file
```

Both React apps proxy `/api` to the backend in development.

## Commands

Run from the repo root:

| Task | Command |
|---|---|
| Install everything | `npm run setup` |
| Start all three apps | `npm run dev` |
| Build both React apps | `npm run build` |
| Seed an empty database (stop the dev server first) | `npm run seed` |

Each app also has its own `npm run dev` / `npm run build` (use `--prefix backend|frontend|admin`).

**Development database:** with `MONGODB_URI` empty in `backend/.env`, the backend starts a private local MongoDB (`mongodb-memory-server`) on port 27027, with data kept in `%LOCALAPPDATA%\shopme\db`. That folder is outside the project so OneDrive never syncs live database files. A fresh database is seeded automatically on startup. To reset it, stop the backend and delete that folder. Production must set `MONGODB_URI` (MongoDB Atlas).

There are no automated tests yet. The pricing rules were checked against the PRD §6.2 worked examples.

## Non-negotiable business rules

Full details in PRD §6–§11. Quick reference:

- **Server calculates all money.** Subtotal, delivery, COD fee, totals, refunds, and stock checks happen in the backend only. Never trust prices/totals sent from the browser.
- **Pricing:** No GST. Discount % = floor((MRP − selling) ÷ MRP × 100).
- **Delivery:** Free when items subtotal ≥ ₹500, else ₹50. **COD fee** ₹50. **COD max order** ₹5,000. All of these are **Business Settings values** and must never be hard-coded.
- **No coupons** in v1.0.
- **Stock is per variant** (size × colour, or shade × volume for beauty). Decrement only on successful payment or COD placement; restore on cancel/approved restock. Use atomic DB updates to prevent overselling; auto-refund if a paid order loses the stock race.
- **Razorpay:** Create the Razorpay order with the server-computed amount; verify signature; also handle the webhook (idempotently) so an order is confirmed even if the browser closes. Never store card/UPI data.
- **Orders** store a snapshot of product name, variant, SKU, MRP, price, and address at purchase time. Order number format: `SHM-YYMMDD-XXXX`.
- **Status flow** moves forward only (PRD §8). Every change is time-stamped and triggers notifications (PRD §12).
- **Cancel** only before Shipped. **Return/exchange** within 7 days of delivery, only for products marked returnable (beauty defaults to non-returnable).
- **Reviews:** Only verified buyers with a Delivered order. One review per product per order. Photos (≤5) and video (≤1, ≤60 s). Pending until admin approves. Admin can reply. Ratings count approved reviews only.
- **Admin:** single admin account, no staff roles in v1.0.
- **India only:** 10-digit mobile, 6-digit pincode, ₹ formatting (en-IN).

## Coding conventions

- Keep frontend, admin, and backend independent; share nothing through relative imports across them.
- Business rules live in backend service modules, not in route handlers or React components.
- Configurable values come from the Settings collection or environment variables.
- Secrets (DB URI, JWT secret, Razorpay keys/webhook secret, email & WhatsApp tokens, Cloudinary keys) go in `.env` files only. Commit `.env.example`, never `.env`.
- Validate all API input on the server. Return friendly, non-technical error messages to the UI.
- Brand colours: navy `#14213D`, orange `#FF7A00`, white background. Define them once as CSS variables/Bootstrap overrides. Mobile-first and responsive (PRD §16).
- Paginate every list endpoint. Compress and lazy-load images.
- Notification sending must never block or fail an order. Log and retry.
- Match the existing style of surrounding code.

## Git workflow (owner's rule, mandatory)

- Two long-lived branches: **`development`** (all work) and **`production`** (live site).
- **Commit before starting each phase** (a checkpoint of the finished state), then build the phase on `development`.
- All commits and pushes go to **`development` only**.
- **Never push or commit directly to `production`.** Production is updated only by merging `development` into it through a pull request **after a proper code review**. No exceptions, including small fixes.
- Enforced locally by `.githooks/pre-push` (blocks pushes to `production`) and `.githooks/pre-commit` (blocks commits on `production`); `git config core.hooksPath .githooks` must be set in each clone. Never bypass them (`--no-verify`). Once the online repo exists, also protect `production` there (require a reviewed pull request, block direct pushes).
- Git on this machine: `C:\Program Files\Git\cmd\git.exe` (may not be on PATH in older shells). Commit identity: `SHOPME <nspreshmapr@gmail.com>`.
- `.env` files are never committed (see `.gitignore`); only `.env.example`.

## Build order

Follow PRD §21 phases. Don't build advanced features ahead of their phase unless asked.

**Progress:**
- ✅ Phase 1: Foundation & Design. All customer pages and admin screens laid out and linked; all models; settings, categories, banners and product read APIs; pricing service. Screens whose function comes later show a "Preview (Phase N)" notice (`PhaseNotice` component). Remove each notice when its feature is built.
- ✅ Phase 2: Catalogue & Admin Basics. Admin login (JWT with `ADMIN_JWT_SECRET`, 5-try/15-min lock, 2 h sliding session via `X-Admin-Token` header, change password); all `/api/admin/*` routes behind `requireAdmin`. Categories, products with variants (optimistic save so live stock is never overwritten; every stock change logged in StockMovement), duplicate/bulk/hide-instead-of-delete, inventory (quick edit, history, CSV export/import), media library (sharp → WebP large/medium/thumb), banners, size charts. Store: filters, facets (`/products/filters`), search suggestions (`/products/suggest`), colour-specific gallery, zoom, video, size chart pop-up.
- ✅ Phase 3: Accounts, Cart & Wishlist. Customer register/login (email or mobile, 5-try/15-min lock, blocked users refused), forgot/reset password (30-min single-use link), My Account (profile, change password, up to 10 addresses with default). Server-priced cart for guests and customers, with warnings (sold out, only X left, price changed, unavailable), max per item from Settings, and the guest cart merged on login. Wishlist (login only) with price-drop note and Move to Cart.
- ✅ Phase 4: Checkout & Payments. Single-page checkout (saved or new address, payment method, review and Terms) with server-computed totals for online and COD. Orders `SHM-YYMMDD-XXXX` (India date, daily Counter) store item, price and address snapshots. COD orders confirm immediately. Online orders go through Razorpay: pending order + Razorpay order for the server total, signature check, payment fetch/capture, webhook backup, retry after failure. Stock is reduced only on COD placement or confirmed payment, with an atomic per-variant `$gte` check and auto-refund when the item sold out meanwhile. Unpaid orders are closed after 30 min (sweeper every 5 min in server.js). Thank-you page, My Orders list and order detail (read-only).
- ⏭ Phase 5: Orders & Fulfilment (next).

**Legal pages:**
- The Privacy Policy (DPDP Act 2023 / Rules 2025), Terms & Conditions and Refund & Cancellation Policy are Markdown files in `backend/src/content/legal/`. They seed Settings `pages.privacy`, `pages.terms` and `pages.refunds`.
- The store renders them with `components/MarkdownText.jsx`, a small safe renderer (no HTML).
- `returns` and `cancellation` are aliases of `refunds`, on both the API and the store routes.
- Proprietor and Grievance Officer: RESHMA PR (owner-provided).
- If business rules change (charges, return window, refund timelines), update these files and the live Settings pages together.
- **Consent (DPDP):** every form that collects personal data uses `components/ConsentCheckbox.jsx`: a required, unticked box whose policy links open in a new tab. This covers register, checkout, contact and newsletter. Registration is refused server-side without `agreeTerms`. `User.consent` stores the acceptance time and `LEGAL_VERSION` (in `content/legal/index.js`); bump that constant whenever a policy changes.
- **Delete my account** (My Account → Profile → Your Data & Privacy): `POST /api/account/delete` requires the password and typed "DELETE". It is refused while orders are in progress (confirmed to out-for-delivery, or open returns). It erases the user, addresses, wishlist, cart and unpaid pending orders, and keeps other orders (legal records). It emails a confirmation first and writes a `DeletionLog` with no personal data.
- The footer's bottom line always links the three policies.

**SMS OTP login & registration (owner request, after Phase 4):**
- Gateway: NetworkZ Systems API v1.0 in `src/integrations/sms.js` (form POST to `send-sms`, MD5 signature chain). Settings come only from `backend/.env`: `SMS_ACCESS_TOKEN`, `SMS_ACCESS_TOKEN_KEY`, `SMS_ENTITY_ID`, `SMS_HEADER`, `SMS_TEMPLATE_ID`, `SMS_OTP_TEMPLATE` (exact DLT text with `{#var#}`), `SMS_ROUTE`. `smsConfigured()` needs all of them.
- Rules live in `services/otpService.js` (`OTP_RULES`): 6 digits, 5 min, 5 wrong tries, 30 s resend, 5 per number per hour, 15 per IP per 15 min. Only an HMAC of the code is stored (`Otp` model, TTL index). Wrong tries use `$inc`; a code is used exactly once.
- Routes: `POST /api/auth/otp/request` `{mobile, purpose: login|register}`, `POST /api/auth/otp/login` `{mobile, code, remember}` (same customer JWT). `POST /api/auth/register` now **requires `otp`** and sets `User.mobileVerifiedAt`. Password login and forgot-password are unchanged.
- Store: Login opens on OTP ("Use password instead"; `?method=password` opens the password form). Register: "Continue: verify mobile" → code → "Verify & Create Account". `components/OtpStep.jsx` has the resend countdown.
- Not fully configured: development returns `devOtp` and shows it in a yellow "Testing mode" box; production refuses OTP (503) so customers use their password. In production set Express `trust proxy` so the per-IP limit sees real addresses.
- Changing the mobile number in My Account does not re-verify by OTP yet.
- A reusable global skill `networkz-sms-otp` (in `~/.claude/skills/`) documents this integration for other projects.

**Phase 4 notes:**
- Razorpay lives in `src/integrations/razorpay.js` (plain fetch, keys from `.env`). With no keys, `payments.onlineAvailable` is false and checkout offers COD only. The webhook is `POST /api/payments/razorpay/webhook`, mounted in app.js before `express.json` (raw body for the HMAC). Event ids are recorded in `Payment.processedEventIds`.
- Every payment attempt is its own Payment doc. `finalizePayment` claims a payment atomically (pending/failed → paid), so browser and webhook confirm once. A second payment on the same order, or a payment after expiry, is refunded automatically. A failed auto-refund leaves the payment `refund_initiated` for the admin (Phase 5/8).
- My Orders hides orders that never reached `confirmed`. The order detail's cancel/return/review/receipt buttons are Phase 5/6 previews.
- Order and admin-alert emails go through the log-only email driver until Phase 7.

**Phase 3 notes:**
- Customer JWT uses `JWT_SECRET`, which must differ from `ADMIN_JWT_SECRET` (startup refuses otherwise). Sessions: 30 days with "Remember me" (localStorage), otherwise 1 day in sessionStorage. A password change or reset ends older logins (`passwordChangedAt`).
- Guest carts are keyed by a random `X-Guest-Id` header (localStorage `shopme.guestId`). `mergeGuestCart` runs on login, register and reset. Cart routes use `optionalCustomer`; account and wishlist routes use `requireCustomer`.
- `src/integrations/email.js` has only a log driver until Phase 7. In development the forgot-password response includes `devResetLink`, shown on screen; never in production or once SMTP is set.
- Checkout and order pages are behind login but still Phase 4/5 previews. "Buy Now" adds to cart and opens /checkout.
- Pincode → city/state auto-fill (PRD §13.8) is not built yet. It needs a pincode lookup service; ask the owner before adding one.

**Phase 2 notes:**
- The single admin account is created on first start from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` in `backend/.env`.
- Development uploads are stored in `%LOCALAPPDATA%\shopme\uploads` and served at `/uploads` (both Vite apps proxy it). `src/integrations/media.js` must get a Cloudinary driver before launch.
- The 60-second video limit is not checked on the server yet (that needs a video tool).
- Hidden categories leave the menu and their page closes; their products stay in search and Shop All.
- Admin list endpoints return `{ items, total, page, pages }`. Pickers that need every row (category and size-chart selects) request `?limit=200`. Categories are paged by top-level category, each with its full sub-tree.
- Stock edits (product form, Inventory quick edit, CSV with "Stock when downloaded") send the value the admin saw (`stockLoaded`). Only the difference is applied to live stock, written compare-and-set. `variants.sku` has a unique index; `Product.syncIndexes()` runs on start. A variant with no `lowStockLevel` uses Settings `orders.lowStockDefault`.
- The top-level `men` / `women` category slugs are locked (the store's /men and /women routes depend on them). In admin, an existing category's web address is read-only until "Change" is clicked, because the owner once typed descriptions into it and broke links. Homepage tiles look up categories by slug and hide themselves if the slug is missing.

## Project Hub (owner's rule, mandatory)

The owner tracks the project in the **SHOPME Project Hub** artifact (https://claude.ai/artifact/J8KvrshBbuSUQTPeudf5vY): overview, a status board by phase (Planned / Not started / In development / Ready for test / Completed), screens, decisions and Git state.

- Keep it current with the **`project-hub` skill** (`.claude/skills/project-hub/SKILL.md`). Run it **on your own, without being asked**, after every task that ends with a commit on `development`: features, fixes, owner requests, phase checkpoints and phase completions. Also run it when the owner asks about progress or status.
- The hub follows **committed** work on `development` only. The skill first commits finished, uncommitted work on development, then updates `tools/project-hub/hub-data.json`, rebuilds with `npm run hub`, republishes to the same URL, and commits the hub as `Update Project Hub: …`.
- Never create a second hub artifact, and never publish or commit to `production` from the skill.

## When finishing a task

- Check that the change works (run it, test the flow), not just that it compiles.
- Tell the owner in plain language what they can now do and how to check it.
- Note any PRD assumption (PRD §24) the work depended on.
- Commit on `development`, then run the `project-hub` skill so the hub matches the new commit.
 