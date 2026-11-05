import fs from 'node:fs';

// SHOPME's legal policies (Markdown). These files are the source text; they
// seed Business Settings → pages and can later be edited by the owner there.
const read = (name) => fs.readFileSync(new URL(`./${name}.md`, import.meta.url), 'utf8').trim();

export const LEGAL_PAGES = {
  privacy: read('privacy-policy'),
  terms: read('terms-and-conditions'),
  refunds: read('refund-and-cancellation-policy'),
};
