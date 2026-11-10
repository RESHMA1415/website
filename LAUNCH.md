# SHOPME Launch Guide

This guide takes SHOPME from "working on this computer" to "live on your own web address". It has three parts:

1. **Before launch: what you (the owner) set up.** These are accounts only you can create.
2. **Going live: what the developer does.** Technical steps, in order.
3. **After launch: everyday care.** Backups, and what to check each week.

The final sign-off list (PRD §22) is at the end. It shows what testing has already covered and what you still need to check yourself.

---

## Part 1: Accounts to set up (owner)

Create these accounts in your business name and email. Send the developer the details marked **"send"**. Never post them in a group chat or email them to anyone else.

| # | Account | What it's for | What to send the developer | Cost to start |
|---|---|---|---|---|
| 1 | **Domain name** (e.g. GoDaddy, Hostinger, BigRock) | Your web address, e.g. `shopme.in` | Login to the domain's DNS settings, or add the records the developer gives you | About ₹500–1,000 a year |
| 2 | **Hosting**: decide between Option A and Option B below | Runs the website 24 hours a day | Login, or invite the developer to the account | Small monthly fee |
| 3 | **MongoDB Atlas** (mongodb.com/atlas) | The online database: products, orders, customers | Invite the developer to the project | Free tier to start |
| 4 | **Cloudinary** (cloudinary.com) | Stores product photos, review photos and videos, and the nightly backup copies | The "API environment variable" from the Cloudinary dashboard (starts with `cloudinary://`) | Free tier to start |
| 5 | **Gmail App Password** | Lets the store send order emails from your Gmail | The 16-letter App Password (Google Account → Security → 2-Step Verification → App passwords) | Free |
| 6 | **Razorpay live mode** | Real online payments | Finish Razorpay's business verification (KYC). Once approved, send the **live** Key Id and Key Secret | About 2% per payment |
| 7 | **GitHub** (github.com) | Safe online copy of the code, with the `production` branch protected | Create a private repository and invite the developer | Free |

Later, not needed for launch: WhatsApp Business Platform (automatic WhatsApp messages, on hold at your request) and the NetworkZ SMS route for OTP login (on hold).

### Choosing hosting

**Option A: one server for everything (recommended).** The shop, admin panel and server run together as one service, for example a Render "Web Service" on an always-on paid plan, or a small VPS (Hostinger, DigitalOcean) with Nginx. It's the simplest and cheapest to run. The admin panel opens at `https://your-domain/admin`.

**Option B: separate parts.** The shop and admin are put on a static host (Vercel or Netlify) and the server on Render or Railway. It's more pieces to look after, with no real benefit at SHOPME's size.

Whichever you pick, the server must be **always on**. Free plans that go to sleep would stop the nightly backup, the closing of unpaid orders and email retries.

---

## Part 2: Going live (developer)

### 2.1 Online database (MongoDB Atlas)

1. Create a cluster in the **Mumbai (ap-south-1)** region.
2. Create a database user with a long random password.
3. Under Network Access, allow the hosting server's address (or `0.0.0.0/0` on Render, protected by the password).
4. Copy the connection string into `MONGODB_URI` and add the database name, e.g. `.../shopme?retryWrites=true&w=majority`.

On first start, the server creates the essentials in an empty database by itself: Business Settings, the policy pages and the category menu (Men, Women and their sub-categories). It does **not** add sample products or banners. The admin account is created from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`.

### 2.2 Server settings (environment variables)

Set these on the host, never in the code. `backend/.env.example` lists every setting with notes.

| Setting | Value for launch |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | given by the host (Render sets it) |
| `MONGODB_URI` | the Atlas connection string |
| `STORE_URL` | `https://shopme.in` (your domain) |
| `ADMIN_URL` | `https://shopme.in/admin` (Option A) |
| `CLIENT_URLS` | `https://shopme.in` (add `https://www.shopme.in` if used) |
| `JWT_SECRET`, `ADMIN_JWT_SECRET` | two **different** random values, 32+ characters each (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
| `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | owner's admin login. Change the password after the first login |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **live** keys (`rzp_live_…`) |
| `RAZORPAY_WEBHOOK_SECRET` | the secret typed when creating the webhook (2.5) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Gmail: `smtp.gmail.com`, `465`, `true`, the Gmail address, the App Password |
| `CLOUDINARY_URL` | `cloudinary://…` from the Cloudinary dashboard |
| `CLOUDINARY_FOLDER` | `shopme` |
| `BACKUP_KEY` | a random value, 32+ characters. **Also give the owner a copy to keep safe (for example on paper in a locked drawer). Without it, no backup can be opened.** |
| `BACKUP_KEEP_DAYS` | `30` |
| `TRUST_PROXY` | `1` on Render, or behind Nginx or Cloudflare |
| `STORE_DIST`, `ADMIN_DIST` | Option A: `../frontend/dist` and `../admin/dist` |

The server refuses to start in production if `MONGODB_URI` is missing, if any address is not `https://`, or if a secret is shorter than 32 characters. That's on purpose.

### 2.3 Build and start

**Option A (one server)**, run from the project folder:

```
npm run setup          # installs everything
npm run build:server   # builds the shop (/) and the admin panel (/admin)
npm start              # starts the server
```

On Render, use Build Command `npm run setup && npm run build:server` and Start Command `npm start`, with the root directory set to the project folder. To skip the development-only database download during install, set `MONGOMS_DISABLE_POSTINSTALL=1`.

On a VPS, run `npm start` under PM2 (`pm2 start npm --name shopme -- start`, then `pm2 save` and `pm2 startup`), behind Nginx with a free Let's Encrypt certificate (certbot). Nginx forwards everything to `http://127.0.0.1:5000`. Allow uploads up to 60 MB (`client_max_body_size 60m;`) so review videos fit.

**Option B (separate parts):**
- **Shop:** `npm run build --prefix frontend`, publish `frontend/dist`, with a rewrite of all paths to `/index.html`, and `/api/*`, `/sitemap.xml` and `/robots.txt` forwarded to the server.
- **Admin:** `npm run build --prefix admin`, publish `admin/dist`, with `/api/*` forwarded to the server.
- **Server:** `npm start --prefix backend`, with `CLIENT_URLS` set to both addresses.

### 2.4 Domain and HTTPS

1. Point the domain at the host: the host tells you the DNS records (usually an `A` record for `@` and a `CNAME` for `www`).
2. Turn on HTTPS. Render does this automatically; on a VPS use certbot.
3. Check that `http://` redirects to `https://`, and that the padlock shows on the shop and the admin panel.

### 2.5 Razorpay: switch to live

1. In the Razorpay Dashboard, switch to **Live Mode** and generate the live API keys. Put them in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. Under **Settings → Webhooks → Add New Webhook**:
   - URL: `https://shopme.in/api/payments/razorpay/webhook`
   - Secret: a new random value, also put in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`
3. Restart the server. In the admin, Business Settings → Payments (Razorpay) should show it connected in live mode.
4. Place one real order for the cheapest product with your own card or UPI. Check that the order is Confirmed, then cancel and refund it from the admin and check the refund in Razorpay.

### 2.6 Search engines

1. Add the site to **Google Search Console** and submit `https://shopme.in/sitemap.xml`.
2. In Business Settings → Search Engines & Sharing (SEO), fill in the site title, description and a share image, so links shared on WhatsApp look good.

### 2.7 Git and the production branch

1. Push `development` to the GitHub repository.
2. Open a pull request from `development` into `production`. It's reviewed, then merged. Never push straight to `production`.
3. Protect `production` on GitHub: require a reviewed pull request and block direct pushes.
4. The host deploys from `production`.

---

## Part 3: After launch

### Daily backups

- Every night after 2 AM (India time), the server makes a full, encrypted copy of the database. It saves one copy in Cloudinary (private) and one on the server, and deletes copies older than 30 days.
- **Admin → My Account → Database backups** shows the last good backup. The **Back up now** button makes an extra copy any time, for example before a big product import.
- If a backup doesn't complete, the store emails the admin alert address set in Business Settings → Emails.
- **To restore** (developer): download the backup file from the Cloudinary Media Library (folder `shopme/backups`) or take it from the server's backup folder. Stop the server, then run:
  - `npm run restore -- <file> --check` to see what's inside;
  - then `npm run restore -- <file> --replace`.
  This needs the same `BACKUP_KEY`.
- Atlas also offers its own backups on paid tiers. They are optional, as a second safety net.

### Weekly owner checks

- Dashboard: orders to pack, returns waiting, reviews to approve, new contact messages.
- My Account → Store emails shows **Connected**, and Database backups shows a backup from last night.
- Inventory: sold-out and low-stock items (the daily stock email lists them too).
- Payments: any refund marked "needs attention".

---

## Launch acceptance checklist (PRD §22)

**Tested** means automated tests and browser checks covered it during Phases 1–9 (about 480 checks, all passing on 10 November 2026). **Owner** means please check it yourself on the live site before announcing.

| Item | Status |
|---|---|
| All pages open and are linked from menu/footer on desktop, tablet, mobile | Tested. Owner: click through on your phone |
| Filters, sort and search return the right products | Tested |
| Sold-out options can't be selected; out-of-stock can't be bought | Tested |
| Cart subtotal, delivery (₹0 at ₹500+, else ₹50), free-delivery nudge | Tested |
| Wishlist works and needs login | Tested |
| Online payment creates a Confirmed order and reduces stock | Tested (Razorpay test mode). Owner: one live payment (2.5) |
| Closing the browser right after paying still creates the order (webhook) | Tested. Needs the live webhook (2.5) |
| Failed payment shows retry; no order confirmed, no stock reduced | Tested |
| COD adds the ₹50 fee; hidden above ₹5,000 and when switched off | Tested |
| Totals match on checkout, confirmation, email and admin | Tested |
| Admin moves an order through every status; customer timeline updates | Tested |
| Shipping adds courier + tracking and tells the customer | Tested |
| Cancel before shipping; stock back; online payment refunded | Tested |
| Return/Exchange only within 7 days of delivery and only for returnable items | Tested |
| Refunds (Razorpay and manual COD) recorded with the right amounts | Tested |
| Only delivered buyers can review; photos and video upload | Tested. Owner: one review with Cloudinary connected |
| Reviews hidden until approved; admin reply shows | Tested |
| Average rating and breakdown update | Tested |
| Owner adds a product with variants and photos without help | **Owner** |
| Dashboard numbers match a manual count of test orders | Tested. Owner: compare with your own test orders |
| Reports export to Excel/CSV | Tested |
| Business Settings changes take effect on the site | Tested |
| WhatsApp enquiry button opens WhatsApp with the right message | Tested. Owner: try on your phone |
| All emails in §12 received | Tested with a practice mail server. Owner: needs the Gmail App Password. Automatic WhatsApp messages are postponed (your decision) |
| Pages load in under 3 s on mobile 4G | Tested (about 2.4–3 s on a simulated slow phone). Recheck on the live host |
| HTTPS active; admin panel needs login | Admin login: tested. HTTPS: after 2.4 |
| Policy pages published; Razorpay live mode approved | Pages: done (have them reviewed by an advisor, PRD §18). Razorpay live: **Owner** |
| Database backups running | Built and tested. Online copy starts once Cloudinary + `BACKUP_KEY` are set |
| 20 launch products live with photos, stock and descriptions | **Owner** (remove or hide the sample products) |
| Accessibility: contrast, labels, keyboard | Tested (WCAG 2.1 AA check, all pages pass; the SHOPME logo is exempt) |
| Security checks | Tested (13 attack-style checks, 0 known vulnerable packages) |
