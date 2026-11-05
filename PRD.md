# SHOPME — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | SHOPME — online clothing & women's fashion store |
| **Version** | 1.0 (First Launch) |
| **Date** | 3 November 2026 |
| **Owner** | SHOPME business owner (single admin) |
| **Market** | India only (INR ₹) |
| **Status** | Approved requirements, ready for build |

---

## Table of Contents

1. [Purpose & Vision](#1-purpose--vision)
2. [Goals & Success Measures](#2-goals--success-measures)
3. [Scope of First Launch](#3-scope-of-first-launch)
4. [Users & Roles](#4-users--roles)
5. [Product Catalogue](#5-product-catalogue)
6. [Business Rules & Calculations](#6-business-rules--calculations)
7. [Customer Journey (End-to-End Flow)](#7-customer-journey-end-to-end-flow)
8. [Order Lifecycle & Statuses](#8-order-lifecycle--statuses)
9. [Payments](#9-payments)
10. [Cancellations, Returns, Exchanges & Refunds](#10-cancellations-returns-exchanges--refunds)
11. [Customer Reviews](#11-customer-reviews)
12. [Notifications (WhatsApp & Email)](#12-notifications-whatsapp--email)
13. [Customer Website — Pages & Fields](#13-customer-website--pages--fields)
14. [Admin Panel — Modules & Fields](#14-admin-panel--modules--fields)
15. [Data Model (Information the App Stores)](#15-data-model-information-the-app-stores)
16. [Design & Branding](#16-design--branding)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Legal & Policy Pages](#18-legal--policy-pages)
19. [Technology Stack](#19-technology-stack)
20. [Third-Party Accounts the Owner Must Set Up](#20-third-party-accounts-the-owner-must-set-up)
21. [Build Phases](#21-build-phases)
22. [Launch Acceptance Checklist](#22-launch-acceptance-checklist)
23. [Out of Scope / Future Versions](#23-out-of-scope--future-versions)
24. [Assumptions & Decisions to Confirm](#24-assumptions--decisions-to-confirm)
25. [Glossary](#25-glossary)

---

## 1. Purpose & Vision

**SHOPME** is an online store where customers across India can browse and buy **men's clothing, women's clothing, women's fashion, beauty and accessories**. Customers pay online (UPI, cards, net banking, wallets via Razorpay) or by Cash on Delivery, track their orders, and post reviews with photos or videos after receiving their products.

The business owner runs the entire store from **one secure admin panel**: adding products and stock, processing orders, handling returns and refunds, approving and replying to reviews, and seeing sales performance at a glance.

**Vision:** A modern, trustworthy, mobile-friendly fashion store that is easy for customers to shop and simple for a non-technical owner to manage, built so it can grow from 20 products to thousands without rebuilding.

---

## 2. Goals & Success Measures

| Goal | How we measure it |
|---|---|
| Customers can shop easily on any device | Checkout can be completed on mobile in under 3 minutes |
| Owner can run the store without technical help | Owner can add a product with variants and photos in under 5 minutes |
| No overselling | Zero orders placed for out-of-stock size/colour combinations |
| Build customer trust | Only verified buyers can review; every review is moderated |
| Reliable payments | Every successful Razorpay payment creates an order, even if the customer closes the browser |
| Ready to scale | New products, categories and settings can be added from the admin panel with no code changes |

---

## 3. Scope of First Launch

### In scope (Version 1.0)
- Full customer website (all pages in §13)
- Full admin panel (all modules in §14)
- Product catalogue with size/colour variants and per-variant stock
- Cart, wishlist, checkout
- Razorpay online payments and Cash on Delivery (with COD fee)
- Free delivery above ₹500
- Order tracking
- Cancellations, 7-day returns and exchanges, refunds
- Verified-buyer reviews with photos/videos, admin approval and admin replies
- WhatsApp enquiry button and WhatsApp + email order notifications
- Dashboard and sales reports
- Launch with **20 products**, scalable to many more

### Not in scope for Version 1.0
- Coupons / discount codes (owner decision: **no coupons**). The "Coupon Management" item in the original requirements is **removed from launch**.
- GST calculation and GST invoices (owner decision: **no GST**)
- Staff accounts / multiple admin users (owner decision: **admin only**)
- International shipping (**India only**)
- See §23 for the full future list.

---

## 4. Users & Roles

| Role | Who | What they can do |
|---|---|---|
| **Visitor (Guest)** | Anyone browsing | Browse, search, filter, view products and reviews, add to cart, use WhatsApp enquiry, contact form |
| **Customer** | Registered & logged-in user | Everything a visitor can + wishlist, checkout, view/track orders, cancel, request return/exchange, write reviews, manage profile & addresses |
| **Admin** | The business owner only (one account) | Full control of the admin panel. No staff roles in v1.0 |

**Rules**
- Guests can add to cart; they must **log in or register at checkout**. The guest cart is kept and merged into their account when they log in.
- Wishlist requires login.
- The admin panel lives at a separate, private address and has its own login, separate from customer accounts.

---

## 5. Product Catalogue

### 5.1 Category structure

```
Men
 ├─ T-Shirts
 ├─ Shirts
 ├─ Jeans & Trousers
 ├─ Ethnic Wear
 └─ Winter Wear
Women
 ├─ Clothing
 │   ├─ Tops & T-Shirts
 │   ├─ Dresses
 │   ├─ Kurtis & Ethnic Wear
 │   ├─ Jeans & Trousers
 │   └─ Sarees
 ├─ Fashion          (e.g. bags, footwear, scarves, sunglasses)
 ├─ Beauty           (e.g. makeup, skincare, fragrance)
 └─ Accessories      (e.g. jewellery, watches, hair accessories)
```

- Sub-categories above are **starting suggestions**. The admin can add, rename, reorder, hide or delete categories at any time (§14.3).
- A product belongs to **one main category** and **one sub-category**.
- **New Arrivals** is not a category. It automatically shows products added in the **last 30 days** (configurable), newest first. The admin can also tick "Mark as New Arrival" to pin a product there.

### 5.2 Product types and variants

Different products need different options:

| Product type | Variant option 1 | Variant option 2 | Example |
|---|---|---|---|
| **Clothing** (Men & Women) | Size (XS, S, M, L, XL, XXL, or waist 28–40, or Free Size) | Colour | Blue T-Shirt – M |
| **Fashion** (bags, footwear, etc.) | Size (footwear UK 3–11, or "One Size") | Colour | Black Sandal – UK 6 |
| **Beauty** | Shade / Variant (e.g. "Ruby Red") | Volume / Weight (e.g. 30 ml) | Lipstick – Ruby Red – 4 g |
| **Accessories** | Colour / Finish | Size (optional, "One Size") | Gold Earrings – One Size |

- **Each combination is its own variant with its own stock count, its own SKU, and optionally its own price** (e.g. XXL may cost more).
- The admin picks the options when creating a product, and the system generates every combination automatically (e.g. 4 sizes × 3 colours = 12 variants). The admin then enters stock for each one.
- Colour variants can have **their own photos**. When a customer picks "Red", the gallery switches to red photos.

### 5.3 Product information (fields)

| Field | Required | Notes |
|---|---|---|
| Product name | Yes | Max 120 characters |
| URL slug | Auto | Generated from name, e.g. `/product/classic-blue-cotton-tshirt` |
| Main category / sub-category | Yes | |
| Product type | Yes | Clothing / Fashion / Beauty / Accessories (controls variant options) |
| Brand | No | |
| Short description | Yes | 1–2 lines shown near the price |
| Full description | Yes | Rich text |
| **MRP (original price)** | Yes | Shown struck-through when a selling price is lower |
| **Selling price** | Yes | Must be ≤ MRP |
| Discount % | Auto | Calculated, see §6.1 |
| Fabric / material | Clothing & Fashion | e.g. 100% Cotton |
| Fit | Clothing | Slim / Regular / Relaxed / Oversized |
| Pattern, sleeve, neck, occasion | No | Used for filters |
| Wash / care instructions | Clothing | |
| Ingredients, how to use, skin type, expiry/shelf life | Beauty | |
| Size chart | Clothing & footwear | Image or table, chosen from saved size charts |
| Photos | Yes | Min 1, max 8 per product (or per colour). First photo = main image |
| Video | No | One short product video (max 60 seconds) |
| Variants (size × colour etc.) | Yes | Each with SKU, stock, optional price |
| Low-stock alert level | Yes | Default 5 units |
| Returnable? | Yes | Default **Yes** for clothing/fashion/accessories, **No** for beauty (hygiene) |
| Tags | No | Help search, e.g. "summer", "party wear" |
| Gender | Auto | From main category |
| Featured on homepage? | No | Tick box |
| Mark as New Arrival | No | Tick box |
| Status | Yes | Draft / Active / Hidden |
| SEO title & description | No | Auto-filled from name/short description if blank |

### 5.4 Stock rules
- Stock is tracked **per variant**, not per product.
- A product shows **"Out of Stock"** only when **all** its variants have 0 stock. Individual sold-out sizes/colours appear greyed out and cannot be selected.
- When a variant's stock is **≤ low-stock alert level**, it appears in the dashboard's low-stock alerts.
- When stock is **1–3**, the product page shows "Only X left!" to encourage purchase.
- See §6.5 for when stock goes down and back up.

---

## 6. Business Rules & Calculations

All money is in **Indian Rupees (₹)**. Amounts are shown to the customer rounded to the nearest whole rupee. **All prices and totals are calculated by the server** and never trusted from the customer's browser.

### 6.1 Product pricing
- **Discount %** = (MRP − Selling Price) ÷ MRP × 100, rounded down to a whole number.
  - Example: MRP ₹1,499, Selling ₹999 → (500 ÷ 1,499) × 100 = 33.3 → **"33% OFF"**
- If Selling Price = MRP, no discount badge and no struck-through price are shown.
- **No GST** is added. Prices shown are the final product prices.

### 6.2 Cart & order total

```
Items Subtotal   = Σ (Selling price of variant × quantity)
Delivery Charge  = ₹0 if Items Subtotal ≥ ₹500, otherwise ₹50*
COD Charge       = ₹50* if payment method is Cash on Delivery, otherwise ₹0
---------------------------------------------------------------
Order Total      = Items Subtotal + Delivery Charge + COD Charge
You Save         = Σ ((MRP − Selling price) × quantity)
```

\* **₹50 delivery charge and ₹50 COD charge are placeholder amounts**. The owner can change both in **Business Settings** at any time. The free-delivery threshold (₹500) is also editable.

**Free delivery rule:** Checked against the **Items Subtotal** (before COD charge). Exactly ₹500 qualifies for free delivery.

**Worked examples**

| Cart | Subtotal | Delivery | Payment | COD fee | **Total** |
|---|---|---|---|---|---|
| 1 T-shirt ₹399 | ₹399 | ₹50 | Online | ₹0 | **₹449** |
| 1 T-shirt ₹399 | ₹399 | ₹50 | COD | ₹50 | **₹499** |
| 2 T-shirts ₹399 | ₹798 | ₹0 | Online | ₹0 | **₹798** |
| 2 T-shirts ₹399 | ₹798 | ₹0 | COD | ₹50 | **₹848** |

**Free-delivery nudge:** If the subtotal is under ₹500, the cart shows *"Add ₹101 more to get FREE delivery!"* (₹500 − subtotal) with a progress bar.

### 6.3 Quantity limits
- Minimum 1, maximum **5 per variant per order** (configurable), and never more than available stock.
- If a customer tries to add more than the available stock, show: *"Only X available."*

### 6.4 Cash on Delivery rules
- COD fee is added and shown clearly **before** the customer places the order.
- **Maximum COD order value: ₹5,000** (configurable). Above this, only online payment is offered.
- The admin can **switch COD on/off** for the whole store from Business Settings.

### 6.5 Stock movement rules

| Event | Stock effect |
|---|---|
| Item added to cart | No change (stock is checked, not reserved) |
| Checkout started | Stock re-checked; if any item is no longer available, customer is told before paying |
| **Online payment successful** | Stock **reduced** |
| **COD order placed** | Stock **reduced** |
| Online payment failed / abandoned | No change |
| Order cancelled (before shipping) | Stock **restored** |
| Return received & approved as resellable | Stock **restored** (admin confirms "Restock: Yes/No" for damaged items) |
| Exchange approved | Old variant restored (if resellable), new variant reduced |
| Admin manual adjustment | Changed, with a reason recorded (e.g. "New stock arrived", "Damaged") |

**Overselling protection:** If two customers buy the last item at the same moment, only the first successful one gets it. The second is told the item just sold out. If they already paid online, the payment is **automatically refunded**.

### 6.6 Order number format
`SHM-YYMMDD-XXXX`, e.g. **SHM-261103-0042** (date + running number). Shown to customers and used everywhere.

### 6.7 Delivery estimate
- Shown on product page and checkout: **"Delivery in 4–7 business days"** (configurable text/days in Business Settings).
- Delivery is available **anywhere in India**. Pincode must be a valid 6-digit Indian pincode. The city and state auto-fill from the pincode where possible.

### 6.8 Ratings calculation
- **Average rating** = sum of approved review stars ÷ number of approved reviews, shown to **one decimal** (e.g. ★ 4.3).
- Only **approved** reviews count. Pending, rejected or hidden reviews do not.
- The product page shows a breakdown: how many 5★, 4★, 3★, 2★, 1★ reviews, as bars.

### 6.9 Refund amount calculation

| Situation | Refund amount |
|---|---|
| Full order cancelled before shipping (online paid) | Full amount paid |
| Full order cancelled before shipping (COD) | Nothing to refund (not yet paid) |
| Return of some items | Selling price of returned items. Delivery and COD charges are **not refunded** |
| Return of all items | Items' selling price. Delivery and COD charges **not refunded** |
| Wrong / damaged / defective item sent | Full item price **plus** delivery charge (it was our mistake) |
| Exchange | No refund. Replacement is sent free. If the new variant costs more or less, see §10.4 |

---

## 7. Customer Journey (End-to-End Flow)

```
Discover ─► Browse / Search ─► Product Page ─► Select Size & Colour ─► Add to Cart
                                     │
                                     └─► WhatsApp Enquiry (optional)

Cart ─► Checkout ─► Login/Register (if guest) ─► Address ─► Payment Method
                                                                  │
                         ┌────────────────────────────────────────┤
                         ▼                                        ▼
                  Pay Online (Razorpay)                   Cash on Delivery
                         │                                        │
                 Success │ Failure ─► "Retry payment"             │
                         ▼                                        ▼
                    ORDER CONFIRMED  ◄────────────────────────────┘
                         │   (WhatsApp + Email to customer, alert to admin)
                         ▼
                 Admin packs ─► Admin ships (adds courier + tracking no.)
                         │
                         ▼
               Customer tracks order ─► DELIVERED
                         │
         ┌───────────────┼───────────────────────┐
         ▼               ▼                       ▼
   Write a review   Return / Exchange       Done
   (photos/video)   (within 7 days)
         │               │
   Admin approves   Admin approves ─► pickup ─► refund / replacement
   & replies
```

---

## 8. Order Lifecycle & Statuses

### 8.1 Order statuses

| Status | Meaning | Who moves it | Customer sees |
|---|---|---|---|
| **Pending Payment** | Online order created, payment not finished | System | Not shown in My Orders (auto-removed after 30 min if unpaid) |
| **Confirmed** | Paid online, or COD placed | System | "Order Confirmed" |
| **Processing** | Admin is packing | Admin | "Being Packed" |
| **Shipped** | Handed to courier; courier name + tracking number entered | Admin | "Shipped" + tracking link |
| **Out for Delivery** | Courier is delivering today | Admin | "Out for Delivery" |
| **Delivered** | Customer received it | Admin | "Delivered" + "Write a Review" + "Return/Exchange" buttons |
| **Cancelled** | Cancelled by customer or admin before shipping | Customer/Admin | "Cancelled" + refund status |
| **Return Requested** | Customer asked to return/exchange | Customer | "Return Requested" |
| **Return Approved / Rejected** | Admin decision | Admin | Shown with reason |
| **Returned** | Item received back | Admin | "Returned" |
| **Refunded** | Money sent back | Admin/System | "Refunded ₹X" |
| **Exchanged** | Replacement shipped | Admin | Tracking of replacement |
| **Delivery Failed / RTO** | Courier couldn't deliver, returning to us | Admin | "Delivery unsuccessful – we'll contact you" |

### 8.2 Rules
- Status can only move **forward** in the logical order (e.g. cannot go from Delivered back to Processing). The admin can add a note at any step.
- Every status change is **time-stamped** and shown on the customer's Order Tracking timeline.
- Every status change triggers the notifications in §12.
- **COD orders:** When marked **Delivered**, payment status automatically becomes **"Paid (COD collected)"**.
- **RTO (returned to origin) COD orders:** Stock is restored when the parcel comes back.

### 8.3 Shipping process (launch approach)
- For launch, the owner books shipments with **any courier of their choice** (e.g. India Post, Delhivery, DTDC, Shiprocket dashboard).
- In the admin panel, the owner enters **Courier name**, **Tracking number** and (optional) **Tracking URL**, then clicks **"Mark as Shipped"**.
- The customer gets the tracking link by WhatsApp and email.
- **Packing slip / order receipt** can be printed from the admin order page (customer name, address, phone, items, payment method, COD amount to collect).
- Automatic courier integration (Shiprocket API) is a **future feature** (§23).

---

## 9. Payments

### 9.1 Payment methods

| Method | Provider | Notes |
|---|---|---|
| UPI (GPay, PhonePe, Paytm, etc.) | Razorpay | |
| Debit / Credit cards | Razorpay | |
| Net banking | Razorpay | |
| Wallets | Razorpay | |
| **Cash on Delivery** | — | COD fee applies (§6.4) |

### 9.2 Online payment flow
1. Customer clicks **"Pay ₹X"**. The server creates the order (status *Pending Payment*) and a matching Razorpay order **for the server-calculated amount**.
2. The Razorpay payment window opens. The customer pays.
3. The server **verifies the payment is genuine** (Razorpay signature check) before confirming the order.
4. A **backup confirmation from Razorpay (webhook)** also confirms the order. This covers the case where the customer closes the browser or loses internet right after paying.
5. On success: order → **Confirmed**, stock reduced, cart emptied, "Thank You" page shown, notifications sent.
6. On failure: customer sees *"Payment failed. No money was taken. If money was deducted, it will be refunded automatically by your bank in 5–7 days."* with a **Retry Payment** button. The cart is kept.

### 9.3 Payment statuses
`Pending` → `Paid` / `Failed` → (later) `Refund Initiated` → `Refunded` / `Partially Refunded`
COD: `COD – Pending` → `COD – Collected` (on delivery)

### 9.4 Refunds
- **Online orders:** Refunded to the **original payment method** through Razorpay from the admin panel (one click, full or partial). Bank timeline: 5–7 business days.
- **COD orders:** Customer provides **UPI ID or bank account details** in the return request. The admin pays manually and marks the refund as done, recording a transaction reference.

---

## 10. Cancellations, Returns, Exchanges & Refunds

### 10.1 Cancellation
- Customer can cancel **any time before the order is Shipped** from My Orders, choosing a reason (changed my mind, ordered by mistake, found cheaper, delivery too slow, other).
- Admin can also cancel (e.g. stock issue), with a reason that is sent to the customer.
- Online-paid cancellations are refunded in full (§6.9).
- Once shipped, cancellation is not possible. The customer can return the item after delivery.

### 10.2 Return & exchange window
- **7 days from the delivery date.**
- The "Return / Exchange" button appears on delivered orders and **disappears automatically after 7 days**.
- Only products marked **Returnable** can be returned (beauty items are non-returnable by default, except if damaged/wrong).
- Return can be for **some or all items** in an order, and for a chosen quantity.

### 10.3 Return request form (customer)
| Field | Required |
|---|---|
| Items & quantity to return | Yes |
| Return or Exchange | Yes |
| Reason | Yes. Size doesn't fit / Damaged / Wrong item received / Quality not as expected / Colour different from picture / Other |
| Comments | No |
| Photos of the item | **Yes** if reason is Damaged or Wrong item; optional otherwise (max 5) |
| For exchange: new size/colour | Yes (only in-stock variants shown) |
| For COD refund: UPI ID or bank details (account holder, account no., IFSC) | Yes for COD orders |
| Pickup address | Pre-filled with delivery address, editable |

### 10.4 Exchange rules
- Exchange is for a **different size or colour of the same product**.
- If the new variant has the **same price**, there is no extra cost.
- If the new variant is **more expensive**, exchange is not allowed in v1.0. The customer is told to return the item and place a new order. *(Keeps launch simple.)*
- If the new variant is **cheaper**, the difference is refunded.
- If the wanted variant is out of stock, the customer can choose a refund instead.

### 10.5 Return process (admin)
1. Request arrives → admin **Approves** or **Rejects** (reason required, sent to customer).
2. Admin arranges pickup with the courier → marks **Pickup Scheduled** (optional reverse-tracking number).
3. Item arrives → admin inspects → marks **Received**, chooses **Restock: Yes/No**.
4. Admin issues **refund** (§9.4) or **ships the replacement** (enters new tracking).
5. Customer is notified at every step.

---

## 11. Customer Reviews

### 11.1 Who can review
- **Only logged-in customers who bought the product and whose order is Delivered** ("Verified Buyer").
- **One review per product per order.** A customer can **edit** their review within 30 days. Edits go back for approval.

### 11.2 Review form
| Field | Required | Limits |
|---|---|---|
| Star rating | Yes | 1–5 stars |
| Review title | No | Max 80 characters |
| Review text | Yes | 10–1,000 characters |
| Photos | No | Up to 5, JPG/PNG/WebP, max 5 MB each |
| Video | No | 1 video, MP4/MOV, max 60 seconds, max 50 MB |
| Size purchased (auto) | Auto | Shown on review, e.g. "Bought: M, Blue" |
| Fit feedback (clothing) | No | Runs small / True to size / Runs large |

### 11.3 Moderation & reply
- Every new or edited review starts as **Pending** and is **not visible** until the admin approves it.
- Admin actions: **Approve**, **Reject** (with internal reason), **Hide** (later), **Reply**.
- Admin **reply** is shown under the review as *"Response from SHOPME"*. The customer is notified by email when their review is approved and when the admin replies.
- Dashboard shows the count of **reviews waiting for approval**.

### 11.4 How reviews display on the product page
- Average rating + total review count near the product title (e.g. ★ 4.3 · 27 reviews).
- Rating breakdown bars (5★ to 1★).
- **Customer photos & videos gallery** above the review list.
- Each review: name (first name + last initial, e.g. "Priya S."), "Verified Buyer" badge, stars, date, size/colour bought, fit feedback, text, media, admin reply.
- Sort: **Most Recent** (default), Highest Rating, Lowest Rating, With Photos/Videos.
- Filter by star rating.
- Customers can mark a review **"Helpful"** (one vote per customer).
- Product cards (shop pages) show the average star rating.

### 11.5 Review reminder
- **3 days after delivery**, the customer gets an email (and optional WhatsApp) asking them to review their purchase, with a direct link.

---

## 12. Notifications (WhatsApp & Email)

### 12.1 WhatsApp enquiry button
- A floating **WhatsApp button** on every customer page (bottom-right).
- On a product page, it opens WhatsApp with a pre-filled message: *"Hi SHOPME, I'm interested in [Product Name] – [Product Link]."*
- Elsewhere (all other pages, including the Contact page button): *"Hi SHOPME, I would like to know more about your products."* (updated by the owner)
- The WhatsApp number is set in Business Settings.

### 12.2 Automatic messages

| Event | Customer – Email | Customer – WhatsApp | Admin – Email |
|---|---|---|---|
| Account registered | ✅ Welcome | — | — |
| Forgot password | ✅ Reset link | — | — |
| Order confirmed | ✅ Order summary | ✅ | ✅ New order alert |
| Order shipped | ✅ With tracking | ✅ With tracking | — |
| Out for delivery | — | ✅ | — |
| Delivered | ✅ | ✅ | — |
| Order cancelled | ✅ With refund info | ✅ | ✅ |
| Payment failed | ✅ Retry link | — | — |
| Return/exchange requested | ✅ Acknowledgement | — | ✅ New return alert |
| Return approved / rejected | ✅ | ✅ | — |
| Refund processed | ✅ Amount & reference | ✅ | — |
| Review reminder (3 days after delivery) | ✅ | Optional | — |
| Review approved / admin replied | ✅ | — | — |
| New review submitted | — | — | ✅ |
| Low stock | — | — | ✅ Daily summary |
| Contact form submitted | ✅ Acknowledgement | — | ✅ |

**Note:** Automatic WhatsApp messages require the **WhatsApp Business Platform (Meta Cloud API)** with a verified business and **pre-approved message templates**. Meta charges a small fee per message. See §20.

---

## 13. Customer Website — Pages & Fields

**Common to every page**
- **Header:** SHOPME logo, menu (Home, Men, Women ▾ [Clothing, Fashion, Beauty, Accessories], New Arrivals, Shop, About, Contact), search bar, Wishlist icon (with count), Cart icon (with count), Account icon (Login / My Account).
- **Mobile:** hamburger menu, search icon, cart icon. Sticky header.
- **Footer:** About, Contact details (phone, email, address), quick links, policy links (§18), social media icons (Instagram, Facebook, YouTube, etc.), "We accept" payment icons, copyright.
- Floating **WhatsApp button**.

### 13.1 Home
- **Hero banner slider** (up to 5 banners, each with image for desktop + mobile, heading, sub-heading, button text and link). Managed from admin.
- **Shop by Category** tiles: Men, Women Clothing, Fashion, Beauty, Accessories.
- **New Arrivals** row (8 products).
- **Featured / Best Sellers** row (8 products).
- **Promo strip**: "Free delivery on orders above ₹500 · Easy 7-day returns · Cash on Delivery available".
- **Customer reviews** highlight (latest approved 4–5★ reviews).
- Newsletter/WhatsApp updates sign-up (email or phone).

### 13.2 About Us
Brand story, mission, photos, why shop with us. Content editable from Business Settings.

### 13.3 Shop / Men's Collection / Women's Collection / Category pages / New Arrivals
Same layout, pre-filtered by category.
- **Filters:** Category/sub-category, Price range (slider), Size, Colour (swatches), Brand, Fabric, Fit, Occasion, Rating (4★ & above, 3★ & above), Discount (10%+, 25%+, 50%+), In Stock only. (Beauty pages show Shade, Skin type instead of Size/Fabric.)
- **Sort:** Newest, Price Low→High, Price High→Low, Best Selling, Top Rated, Biggest Discount.
- **Product count** (e.g. "Showing 24 of 56 products").
- **Pagination or "Load More"** (24 per page).
- **Product card:** main image (second image on hover), name, selling price, MRP struck-through, discount % badge, ★ rating & count, "New" / "Out of Stock" badge, wishlist heart, quick "Add to Cart" (opens size picker).
- Mobile: filters open in a slide-up panel.

### 13.4 Search
- Search by product name, category, tag, colour, brand.
- **Suggestions while typing** (top 5 products with thumbnails).
- Results page uses the Shop layout with filters.
- "No results" page shows popular products.

### 13.5 Product Details
- Breadcrumb (Home › Women › Dresses › Product).
- **Image gallery** (thumbnails, zoom on hover/pinch, swipe on mobile, video if any).
- Name, brand, ★ rating & review count (click → reviews), selling price, MRP, discount %, "You save ₹X".
- **Colour selector** (swatches, changes photos), **Size selector** (buttons; sold-out greyed). **Size Chart** link (popup).
- Stock message ("In stock" / "Only 2 left!" / "Out of stock").
- **Quantity** selector.
- **Add to Cart**, **Buy Now** (goes straight to checkout), **Wishlist** heart.
- **WhatsApp enquiry** button for this product.
- Delivery info: "Free delivery above ₹500 · Delivery in 4–7 days · COD available · 7-day easy returns" (or "Non-returnable" for beauty).
- Tabs/accordion: Description, Fabric & Care (or Ingredients & How to Use), Size & Fit, Shipping & Returns.
- **Reviews section** (§11.4).
- **"You may also like"** (same sub-category) row.
- **Recently viewed** row.
- Share buttons (WhatsApp, Facebook, copy link).

### 13.6 Wishlist
- Grid of saved products with price, stock status, **Move to Cart** (asks size if needed), **Remove**.
- Shows a note if a price dropped since it was added.

### 13.7 Shopping Cart
- List: image, name, size, colour, unit price, quantity (+/−), line total, remove, move to wishlist.
- Warnings if an item went out of stock or price changed since added.
- **Order summary:** Subtotal, Delivery (₹0 / ₹50), "You save ₹X", Estimated Total. Note: "COD charge applies if you choose Cash on Delivery."
- **Free-delivery progress bar** (§6.2).
- "Continue Shopping" and **"Proceed to Checkout"** buttons.
- Empty cart page with "Shop Now" button.

### 13.8 Checkout (single page, 3 steps)
1. **Delivery Address**: choose a saved address or add new.
   Fields: Full name\*, Mobile number\* (10-digit Indian), Alternate mobile, Pincode\* (6-digit), House/Flat/Building\*, Street/Area\*, Landmark, City\* (auto-fill), State\* (auto-fill, dropdown), Address type (Home/Work), "Save this address".
2. **Payment Method**: "Pay Online (UPI, Cards, Net Banking, Wallets)" or "Cash on Delivery (+₹50)". COD is hidden if disabled or the order is above the COD limit.
3. **Review & Place Order**: items, address, final price breakdown (Subtotal, Delivery, COD charge, **Total**), agree to Terms & Return Policy checkbox, **"Pay ₹X" / "Place Order"** button.

After success → **Order Confirmation page**: "Thank you!", order number, summary, expected delivery, buttons "Track Order" and "Continue Shopping".

### 13.9 Login / Register
- **Register:** Full name\*, Email\*, Mobile number\*, Password\* (min 8 chars, 1 letter + 1 number), Confirm password\*, agree to Terms\*.
- **Login:** Email or mobile + password. "Remember me".
- **Forgot password:** enter email → reset link (valid 30 minutes).
- After login, user returns to the page they were on (e.g. checkout).
- *(Future: login with OTP / Google — §23.)*

### 13.10 My Account
- **Profile:** name, email, mobile, gender (optional), date of birth (optional). Change password.
- **Saved Addresses:** add, edit, delete, set default.
- Quick links: My Orders, Wishlist, My Reviews, Logout.
- **My Reviews:** list of reviews written with status (Pending / Published / Rejected), edit option.

### 13.11 My Orders
- List of orders, newest first: order number, date, item thumbnails, total, payment method, status badge.
- Order detail: items, price breakdown, address, payment info, status timeline, and action buttons: **Track**, **Cancel** (before shipping), **Return/Exchange** (within 7 days of delivery), **Write a Review** (per item, after delivery), **Download Receipt**, **Need help? (WhatsApp)**.

### 13.12 Order Tracking
- Reached from My Orders, or from a public "Track Order" page using **Order number + mobile/email**.
- **Visual timeline:** Confirmed → Packed → Shipped → Out for Delivery → Delivered, with date/time for each completed step.
- Courier name, tracking number and **"Track on courier website"** link.
- Return/exchange progress if applicable.

### 13.13 Contact Us
- Store phone, email, WhatsApp, address, business hours, Google Map embed.
- **Contact form:** Name\*, Email\*, Mobile, Order number (optional), Subject\* (Order issue / Return / Product question / Other), Message\*.
- Submissions appear in admin and send an email to the owner.

### 13.14 Policy pages
Privacy Policy, Terms & Conditions, Shipping Policy, Return & Refund Policy, FAQ (§18).

### 13.15 Other states
- 404 "Page not found" page with search and links.
- Loading skeletons while content loads.
- Friendly error messages (no technical jargon).

---

## 14. Admin Panel — Modules & Fields

Separate secure area, e.g. `admin.shopme.in` or `shopme.in/admin`. **One admin account only.** Left sidebar menu, works on desktop and tablet (mobile usable for quick checks).

### 14.1 Dashboard Overview
**Top cards (with date filter: Today / Last 7 days / This Month / Custom):**
- Total Sales (₹), number of orders, average order value (Total sales ÷ orders)
- New orders waiting to be packed (Confirmed)
- Orders shipped but not delivered
- Pending return/exchange requests
- Reviews waiting for approval
- Low-stock variants count / out-of-stock count
- New customers

**Charts & lists:**
- Sales over time (line chart, daily)
- Orders by status (chart)
- Online vs COD split
- Sales by category
- Top 5 best-selling products (by units and by revenue)
- Latest 10 orders (quick view)
- Low-stock alerts list (product, variant, stock left, "Update stock" button)
- Latest reviews pending approval
- Latest contact-form messages

**Sales calculation rule:** "Sales" = total of orders that are **Confirmed or later**, **excluding Cancelled** orders and **minus refunded amounts**. COD orders count as sales once confirmed; a separate "COD collected" figure shows only delivered COD orders.

### 14.2 Product Management
- **Product list:** thumbnail, name, category, price, total stock, variants count, rating, status (Active/Draft/Hidden), actions (Edit, Duplicate, Hide, Delete).
- Search, filter by category/status/stock, sort.
- **Add/Edit product:** all fields in §5.3, variant generator (§5.2), per-variant SKU/stock/price table, image & video upload with drag-to-reorder, assign photos to colours, preview before publishing.
- **Duplicate product** (fast way to add similar items).
- **Bulk actions:** activate, hide, delete, change category.
- Deleting a product that has orders **hides** it instead (to keep order history intact).

### 14.3 Category Management
- Create/edit/delete main and sub-categories: name, slug, parent, image (for category tiles), banner image (for category page), description, display order, show in menu (yes/no), status.
- Cannot delete a category that still has products (must move them first).

### 14.4 Image Upload (Media Library)
- Upload images and videos (drag & drop, multiple at once).
- Auto-resize and compress images for fast loading (thumbnail, medium, large versions).
- Allowed: JPG, PNG, WebP (max 5 MB); MP4 (max 50 MB).
- Browse, search, delete unused media. Used for products, banners, categories.
- **Homepage banner manager:** add/edit/reorder/schedule hero banners (desktop image, mobile image, heading, sub-text, button text, link, active dates).

### 14.5 Inventory Management
- Table of **every variant**: product, size, colour, SKU, current stock, low-stock level, status.
- **Quick edit** stock in the table, or **bulk update via CSV** upload (download template → fill → upload).
- Filters: Low stock, Out of stock, by category.
- **Stock history log** per variant: date, change (+/−), reason (Order, Cancellation, Return, Manual – New stock / Damaged / Correction), order number if any.
- Export inventory to CSV/Excel.

### 14.6 Customer Management
- Customer list: name, email, mobile, registration date, number of orders, total spent, last order date, status.
- Customer detail: profile, addresses, order history, reviews, return history.
- **Block/unblock** a customer (blocked users cannot log in or order, e.g. for repeated fake COD orders).
- Search & filter; export to CSV.

### 14.7 Order Management
- **Order list:** order number, date, customer, items count, total, payment method, payment status, order status, actions.
- Filters: status, payment method, payment status, date range; search by order number/customer/mobile.
- Tabs for quick access: New (Confirmed), Processing, Shipped, Delivered, Cancelled, Returns.
- **Order detail page:**
  - Customer & delivery address (copy button), items with variant & SKU, price breakdown, payment details (Razorpay payment ID).
  - Status buttons: Mark Processing → Mark Shipped (enter courier, tracking no., tracking URL) → Out for Delivery → Delivered; Cancel (reason).
  - **Print packing slip / receipt.**
  - Internal notes (only admin sees).
  - Full status timeline with timestamps.
- **Returns & Exchanges** sub-section: list of requests, view photos/reason, Approve/Reject, Pickup scheduled, Received (Restock Yes/No), Refund / Ship replacement.
- Bulk: mark selected as Processing/Shipped, print packing slips.

### 14.8 Payment Management
- List of all payments: date, order number, customer, amount, method (UPI/Card/NetBanking/Wallet/COD), Razorpay payment ID, status (Paid/Failed/Refunded/Partially Refunded/COD Pending/COD Collected).
- **Issue refund** (full or partial) for online payments via Razorpay. Records manual refunds for COD (UPI/bank reference number).
- Filters & totals: total collected online, COD collected, COD pending, refunds issued, by date range.
- Export to CSV.

### 14.9 Review Management *(new — not in original document)*
- List: product, customer, stars, text preview, media thumbnails, date, status (Pending/Approved/Rejected/Hidden).
- Tabs: **Pending** (default), Approved, Rejected.
- Actions: Approve, Reject (reason), Hide, **Reply** (edit/delete reply), view full photos/video.
- Bulk approve.

### 14.10 Sales Reports
All reports have a date-range picker and **Export to CSV/Excel**.
- **Sales summary:** gross sales, refunds, net sales, number of orders, average order value, delivery charges collected, COD charges collected.
- **Sales by day/week/month** (chart + table).
- **Sales by product** and **by variant** (units sold, revenue).
- **Sales by category.**
- **Payment method report** (Online vs COD, and online by type).
- **Returns report** (count, reasons, refund amount, return rate % = returned units ÷ delivered units × 100).
- **Customer report** (new vs returning customers, top customers by spend).
- **Inventory report** (stock value = Σ stock × selling price, low/out-of-stock list).
- **Cancelled orders report** (with reasons).

### 14.11 Business Settings
| Section | Settings |
|---|---|
| Store details | Store name, logo, favicon, contact email, phone, WhatsApp number, address, business hours |
| Delivery | Free-delivery threshold (₹500), delivery charge below threshold (₹50), delivery estimate text/days |
| Cash on Delivery | Enable/disable COD, COD charge (₹50), maximum COD order value (₹5,000) |
| Orders | Max quantity per item per order (5), return window days (7), New Arrival period (30 days), low-stock default (5) |
| Payments | Razorpay key ID & secret (stored securely, shown masked), test/live mode switch |
| Notifications | Turn individual email/WhatsApp messages on/off, admin alert email address |
| Social media | Instagram, Facebook, YouTube, X, Pinterest links |
| Pages content | About Us, Privacy Policy, Terms, Shipping Policy, Return Policy, FAQ (editable text) |
| SEO | Default site title, description, social share image |
| Admin account | Change admin email/password, enable two-step login (OTP on email) |

### 14.12 Contact Messages *(supporting module)*
- Inbox of contact-form submissions: name, email, mobile, subject, message, date, status (New / Replied / Closed). Reply by email link.

### 14.13 Coupon Management
- **Removed from Version 1.0** per owner decision. Planned for a future version (§23).

---

## 15. Data Model (Information the App Stores)

Plain-language description of the main records the database keeps. Developers will translate this into MongoDB collections.

| Record | Key information |
|---|---|
| **Admin** | Name, email, password (encrypted), two-step login setting, last login |
| **Customer (User)** | Name, email, mobile, password (encrypted), gender, date of birth, saved addresses, wishlist, blocked flag, created date |
| **Address** (inside Customer) | Name, mobile, alternate mobile, pincode, house, street, landmark, city, state, type, default flag |
| **Category** | Name, slug, parent category, image, banner, description, order, show-in-menu, status |
| **Product** | Name, slug, category, sub-category, type, brand, descriptions, MRP, selling price, attributes (fabric, fit, care, ingredients…), size chart, images (per colour), video, tags, returnable flag, featured, new-arrival flag, status, SEO fields, average rating, review count, units sold, created date |
| **Variant** (inside or linked to Product) | Option values (size, colour / shade, volume), SKU, stock, low-stock level, price override, images |
| **Cart** | Customer (or guest ID), items (product, variant, quantity), last updated |
| **Order** | Order number, customer, items (snapshot of name, image, variant, SKU, MRP, price, quantity at time of order), address snapshot, subtotal, delivery charge, COD charge, total, payment method, payment status, order status, status history (status, time, note), courier, tracking number/URL, cancellation reason, internal notes, created date |
| **Payment** | Order, Razorpay order ID, Razorpay payment ID, amount, method, status, refunds (amount, Razorpay refund ID or manual reference, date) |
| **Return / Exchange Request** | Order, items & quantities, type (return/exchange), reason, comments, photos, new variant (exchange), refund details (UPI/bank for COD), pickup address, status history, restock decision, refund amount |
| **Review** | Product, customer, order, variant bought, stars, title, text, photos, video, fit feedback, status, rejection reason, admin reply (text, date), helpful votes, created/edited date |
| **Stock Movement** | Variant, change (+/−), reason, related order/return, admin note, date |
| **Banner** | Desktop image, mobile image, heading, sub-text, button text, link, order, active from/to, status |
| **Size Chart** | Name, type (clothing men/women, footwear), image or table |
| **Contact Message** | Name, email, mobile, order number, subject, message, status, date |
| **Settings** | All Business Settings values (§14.11) |
| **Notification Log** | Type, channel (email/WhatsApp), recipient, status (sent/failed), date. Useful for checking whether a customer got a message |

**Important rule:** Orders store a **snapshot** of product details and prices at the time of purchase, so later price or product changes never alter past orders.

---

## 16. Design & Branding

| Element | Specification |
|---|---|
| Background | White `#FFFFFF` (light grey `#F7F7F9` for sections) |
| Primary colour | Navy Blue `#14213D` (header, footer, headings, primary text) |
| Accent colour | Orange `#FF7A00` (buttons, badges, highlights, links, sale tags) |
| Success / Error | Green for success messages, red for errors and "Out of stock" |
| Fonts | Clean modern sans-serif (e.g. *Poppins* for headings, *Inter* for body text) |
| Style | Modern fashion look: large lifestyle photos, generous white space, rounded buttons, soft card shadows, smooth hover effects |
| Product images | Consistent aspect ratio (portrait 3:4) for a neat grid |
| Responsive | Desktop (≥1200px: 4 products per row), Tablet (768–1199px: 3 per row), Mobile (<768px: 2 per row) |
| Icons | Consistent icon set (cart, heart, user, search, WhatsApp) |
| Admin panel | Same colours, clean data-focused layout, navy sidebar |

---

## 17. Non-Functional Requirements

### 17.1 Performance
- Pages load in **under 3 seconds on a 4G mobile connection**.
- Images are compressed, served in modern formats (WebP) and loaded only when scrolled into view.
- Product lists are paginated so the site stays fast with thousands of products.

### 17.2 Security
- Passwords are **encrypted** (never stored as plain text).
- Login sessions use secure tokens (JWT) that expire; admin session expires after **2 hours** of inactivity.
- Admin panel is completely separate from customer login; customers can never access admin functions.
- **All prices, totals, stock checks and discounts are calculated on the server.**
- Every Razorpay payment is **verified** (signature check + webhook) before the order is confirmed.
- Card/UPI details are **never** stored by SHOPME; Razorpay handles them.
- Limit repeated login attempts (lock for 15 minutes after 5 failed tries) to block password guessing.
- Uploaded files are checked for type and size.
- Whole site runs on **HTTPS** (secure padlock).
- Secret keys (Razorpay, email, WhatsApp, database) are kept in secure server settings, never in the website code.
- Regular automatic **database backups** (daily, kept for 30 days).

### 17.3 Reliability
- If an email/WhatsApp message fails, it is retried and logged; failure never blocks an order.
- Clear, friendly error messages for customers; detailed error logs for developers.

### 17.4 SEO & sharing
- Clean page addresses (e.g. `/women/dresses/floral-maxi-dress`).
- Page titles and descriptions per product/category.
- Sitemap for Google, product information marked up for Google Shopping-style results.
- Nice previews when links are shared on WhatsApp/Instagram/Facebook (image + title + price).

### 17.5 Accessibility
- Readable font sizes, good colour contrast, images have descriptions (alt text), the site can be used with a keyboard, forms have clear labels and errors.

### 17.6 Browser & device support
- Latest Chrome, Safari, Edge, Firefox; Android and iPhone browsers.

### 17.7 Scalability
- Built to handle growth from **20 products to 10,000+** and many simultaneous shoppers without redesign.
- New categories, products, banners and settings are managed from admin with **no code changes**.

---

## 18. Legal & Policy Pages

Required for customer trust **and for Razorpay account approval**:
- **Privacy Policy** (what customer data is collected and why)
- **Terms & Conditions**
- **Shipping Policy** (delivery areas: all India; timelines; free delivery above ₹500; charges)
- **Return, Exchange & Refund Policy** (7-day window, non-returnable items, refund timelines, COD refund method)
- **Cancellation Policy** (before shipping)
- **Contact Us** with business address and phone
- **FAQ**

All are editable from Business Settings. *The owner should have these reviewed by a legal/business advisor.*

---

## 19. Technology Stack

| Part | Technology |
|---|---|
| Customer website | React.js, Bootstrap + custom CSS |
| Admin panel | React.js (separate app), Bootstrap + custom CSS |
| Server (backend) | Node.js + Express.js |
| Database | MongoDB (MongoDB Atlas recommended for hosting) |
| Login / security | JWT (JSON Web Tokens), encrypted passwords |
| Payments | Razorpay (Checkout + Webhooks + Refunds) |
| Email | Transactional email service (e.g. Brevo, SendGrid, Amazon SES, or Gmail SMTP for low volume) |
| WhatsApp | Click-to-chat link (enquiry) + WhatsApp Business Platform / Meta Cloud API (automatic messages) |
| Image & video storage | Cloud media storage with auto-resizing (e.g. Cloudinary) |
| Hosting (suggested) | Frontend & admin: Vercel / Netlify; Backend: Render / Railway / AWS; Database: MongoDB Atlas |
| Domain & HTTPS | Custom domain (e.g. shopme.in) with SSL certificate |

**Project structure:** three separate parts: `frontend` (customer site), `admin` (admin panel), `backend` (server & database), as requested in the original requirements.

---

## 20. Third-Party Accounts the Owner Must Set Up

| Account | Why | Notes |
|---|---|---|
| **Domain name** | Website address | e.g. shopme.in (~₹500–1,000/year) |
| **Razorpay** | Online payments | Requires PAN, bank account, business details, website with policy pages. ~2% per transaction |
| **Meta Business + WhatsApp Business Platform** | Automatic WhatsApp messages | Business verification; message templates must be approved by Meta; small per-message fee |
| **Email sending service** | Order emails | Free tiers available for low volume |
| **MongoDB Atlas** | Database | Free tier to start |
| **Cloudinary** (or similar) | Product images/videos | Free tier to start |
| **Hosting** | Run the site | Free/low-cost tiers to start |
| **Business email** | e.g. support@shopme.in | Looks professional in customer emails |

---

## 21. Build Phases

Even though everything ships together at launch, it is built in this order so each part can be checked along the way.

| Phase | What gets built | Owner checks |
|---|---|---|
| **1. Foundation & Design** | Project setup (frontend, admin, backend), all pages with navigation, header/footer, branding, responsive layouts, database structure | Click through every page on phone & laptop; approve look & feel |
| **2. Catalogue & Admin Basics** | Admin login, categories, products with variants, image upload, inventory, banners; customer shop pages, filters, search, product page | Add the first 20 products yourself |
| **3. Accounts, Cart & Wishlist** | Register/login, forgot password, My Account, addresses, cart, wishlist | Create a test account, add items |
| **4. Checkout & Payments** | Checkout, delivery/COD calculations, Razorpay (test mode), COD, order confirmation | Place test orders (online & COD) |
| **5. Orders & Fulfilment** | Order management, statuses, tracking, packing slip, cancellations, returns/exchanges, refunds | Run a full order from placing to refund |
| **6. Reviews** | Review form with photos/video, moderation, replies, ratings display | Write, approve and reply to a review |
| **7. Notifications** | Emails, WhatsApp button, WhatsApp automatic messages | Receive all messages for a test order |
| **8. Dashboard & Reports** | Dashboard, sales reports, payment management, customer management, settings | Check numbers match test orders |
| **9. Testing & Launch** | Full testing, speed & security checks, policy pages, switch Razorpay to live, go live on domain | Final sign-off using §22 |

---

## 22. Launch Acceptance Checklist

The store is ready to launch when **all** of the following are true:

**Shopping**
- [ ] All pages in §13 open and are linked from the menu/footer, on desktop, tablet and mobile
- [ ] Filters, sort and search return correct products
- [ ] Sold-out sizes/colours cannot be selected; out-of-stock products cannot be bought
- [ ] Cart shows correct subtotal, delivery (₹0 at ≥₹500, else ₹50) and free-delivery nudge
- [ ] Wishlist works and requires login

**Checkout & payments**
- [ ] Online payment via Razorpay creates a Confirmed order and reduces stock
- [ ] Closing the browser right after paying still creates the order (webhook)
- [ ] Failed payment shows retry, no order is confirmed, no stock is reduced
- [ ] COD adds the COD fee, is hidden above the COD limit and when disabled
- [ ] Totals on checkout, confirmation page, email and admin all match

**Orders**
- [ ] Admin can move an order through every status; customer timeline updates
- [ ] Shipping adds courier + tracking link, sent to customer
- [ ] Customer can cancel before shipping; stock restored; online payment refunded
- [ ] Return/Exchange button appears only for 7 days after delivery and only for returnable items
- [ ] Refunds (Razorpay and manual COD) recorded and correct amounts per §6.9

**Reviews**
- [ ] Only delivered buyers can review; photos and video upload works
- [ ] Reviews hidden until approved; admin reply appears under the review
- [ ] Average rating and breakdown update correctly

**Admin**
- [ ] Owner can add a product with variants and photos without help
- [ ] Dashboard numbers match a manual count of test orders
- [ ] Reports export to Excel/CSV
- [ ] All Business Settings changes take effect on the site

**Notifications**
- [ ] WhatsApp enquiry button opens WhatsApp with the right message
- [ ] All emails and WhatsApp messages in §12 are received

**Quality & safety**
- [ ] Pages load in under 3 s on mobile 4G
- [ ] HTTPS active; admin panel not reachable without login
- [ ] Policy pages published; Razorpay live mode approved
- [ ] Database backups running
- [ ] 20 launch products live with photos, stock and descriptions

---

## 23. Out of Scope / Future Versions

| Feature | Priority for next version |
|---|---|
| Coupons & discount codes | High |
| Login with mobile OTP / Google | High |
| Shiprocket (or similar) courier integration: auto-booking, live tracking, pincode serviceability | High |
| GST invoices (if/when GST-registered) | Medium |
| Staff accounts with limited permissions | Medium |
| Abandoned-cart reminders (email/WhatsApp) | Medium |
| Loyalty points / referral program | Medium |
| Product recommendations ("Frequently bought together") | Medium |
| Paying the price difference on exchanges | Low |
| Gift wrapping / gift cards | Low |
| Multiple languages (Hindi, regional) | Low |
| Mobile apps (Android/iOS) | Low |
| International shipping | Low |
| Blog / style guide | Low |

---

## 24. Assumptions & Decisions to Confirm

These were filled in by the product manager where the owner said *"as per your suggestion"* or didn't specify. **All amounts are editable later in Business Settings.**

| # | Assumption | Owner to confirm |
|---|---|---|
| 1 | Delivery charge below ₹500 is **₹50** | ☐ |
| 2 | COD extra charge is **₹50** | ☐ |
| 3 | Maximum COD order value is **₹5,000** | ☐ |
| 4 | Beauty products are **non-returnable** (unless damaged/wrong) for hygiene reasons | ☐ |
| 5 | Delivery & COD charges are **not refunded** on normal returns (refunded if our mistake) | ☐ |
| 6 | Exchanges only for same-or-lower-priced variants of the same product | ☐ |
| 7 | Shipping at launch is booked manually with any courier; tracking details entered in admin | ☐ |
| 8 | Cancellation allowed only before the order is shipped | ☐ |
| 9 | Max 5 units per size/colour per order | ☐ |
| 10 | Customers must register/login to check out (no guest checkout) | ☐ |
| 11 | Coupon Management removed from v1.0 | ☐ |
| 12 | Review edits allowed within 30 days and re-moderated | ☐ |
| 13 | Delivery estimate "4–7 business days" across India | ☐ |
| 14 | Store domain name (e.g. shopme.in) | ☐ to be provided |
| 15 | Business contact details, WhatsApp number, social links, logo | ☑ Phone +91 80891 11500, email shopmesupport2@gmail.com, open 24 hours, current logo approved. WhatsApp assumed to be the same number. Social links not created yet (hidden). **Store address still needed** (Razorpay requires it) |
| 16 | Customer login stays for **30 days** with "Remember me"; otherwise it ends when the browser closes (at most 1 day) | ☐ |
| 17 | A customer can save up to **10 addresses**; a cart holds up to 50 different items; a wishlist up to 200 products | ☐ |

---

## 25. Glossary

| Term | Meaning |
|---|---|
| **MRP** | Maximum Retail Price, the original price shown struck-through |
| **Selling price** | The price the customer actually pays for the product |
| **Variant** | One specific combination, e.g. "Blue, size M" |
| **SKU** | Stock Keeping Unit, a unique code for each variant (e.g. SHM-TS-BLU-M) |
| **COD** | Cash on Delivery, where the customer pays the courier in cash |
| **RTO** | Return to Origin, where a parcel that couldn't be delivered comes back to the store |
| **Webhook** | An automatic message Razorpay sends to our server to confirm a payment |
| **JWT** | Secure digital "pass" that keeps a user logged in |
| **Verified Buyer** | A customer who actually bought and received the product |
| **Admin panel** | The private back-office where the owner manages the store |
