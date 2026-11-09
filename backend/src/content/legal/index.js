import fs from 'node:fs';

// SHOPME's legal policies (Markdown). These files are the source text; they
// seed Business Settings → pages and can later be edited by the owner there.
const read = (name) => fs.readFileSync(new URL(`./${name}.md`, import.meta.url), 'utf8').trim();

// The policy version customers agree to (their "Last updated" date). Change it
// whenever a policy changes, so each customer's consent shows which text they accepted.
export const LEGAL_VERSION = '2026-11-09';

export const LEGAL_PAGES = {
  privacy: read('privacy-policy'),
  terms: read('terms-and-conditions'),
  refunds: read('refund-and-cancellation-policy'),
};

// Customer-help pages (Business Settings → pages)
export const INFO_PAGES = {
  shipping: read('shipping-policy'),
  faq: read('faq'),
};
