import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { Category, Product } from '../models/index.js';
import { getSettings } from './settingsService.js';

// Search engines and link previews (PRD §17.4): sitemap.xml, robots.txt and,
// when the server also serves the built store (STORE_DIST), page-specific
// title/description/image tags so WhatsApp, Facebook and Google see them
// without running JavaScript.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const absolute = (url) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${env.storeUrl}${url.startsWith('/') ? '' : '/'}${url}`);

export async function sitemapXml() {
  const [products, categories] = await Promise.all([
    Product.find({ status: 'active' }, { slug: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).limit(50000).lean(),
    Category.find({ status: 'active' }, { slug: 1, updatedAt: 1 }).lean(),
  ]);
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/shop', priority: '0.8' },
    { loc: '/men', priority: '0.8' },
    { loc: '/women', priority: '0.8' },
    { loc: '/new-arrivals', priority: '0.8' },
    ...categories.filter((c) => !['men', 'women'].includes(c.slug)).map((c) => ({ loc: `/category/${c.slug}`, lastmod: day(c.updatedAt), priority: '0.7' })),
    ...products.map((p) => ({ loc: `/product/${p.slug}`, lastmod: day(p.updatedAt), priority: '0.9' })),
    ...['about', 'contact', 'policies/shipping', 'policies/refunds', 'policies/privacy', 'policies/terms', 'policies/faq'].map((p) => ({ loc: `/${p}`, priority: '0.3' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(env.storeUrl + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

export function robotsTxt() {
  return `User-agent: *
Disallow: /account
Disallow: /checkout
Disallow: /cart
Disallow: /order-confirmation
Disallow: /login
Disallow: /register
Disallow: /reset-password
Disallow: /newsletter/
Allow: /

Sitemap: ${env.storeUrl}/sitemap.xml
`;
}

// ---------- Link previews for the served store ----------
let template = null;
function storeTemplate() {
  if (template === null) {
    const file = env.storeDist && path.join(env.storeDist, 'index.html');
    template = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }
  return template;
}

async function metaFor(urlPath) {
  const settings = await getSettings();
  const site = settings.store?.name || 'SHOPME';
  const base = { title: settings.seo?.title || site, description: settings.seo?.description || '', image: settings.seo?.shareImageUrl || settings.store?.logoUrl || '', type: 'website' };
  let m = urlPath.match(/^\/product\/([^/?#]+)/);
  if (m) {
    const p = await Product.findOne({ slug: decodeURIComponent(m[1]), status: 'active' }, { name: 1, shortDescription: 1, description: 1, sellingPrice: 1, images: 1 }).lean();
    if (p) {
      return {
        title: `${p.name} | ${site}`,
        description: `₹${Number(p.sellingPrice).toLocaleString('en-IN')} · ${(p.shortDescription || p.description || '').replace(/\s+/g, ' ').slice(0, 150)}`,
        image: p.images?.[0]?.mediumUrl || p.images?.[0]?.url || base.image,
        type: 'product',
        price: p.sellingPrice,
      };
    }
  }
  m = urlPath.match(/^\/(?:category\/([^/?#]+)|(men|women))\/?$/);
  if (m) {
    const c = await Category.findOne({ slug: decodeURIComponent(m[1] || m[2]) }, { name: 1, description: 1, imageUrl: 1, bannerUrl: 1 }).lean();
    if (c) return { ...base, title: `${c.name} | ${site}`, description: c.description || base.description, image: c.bannerUrl || c.imageUrl || base.image };
  }
  return base;
}

export async function renderStorePage(urlPath) {
  const html = storeTemplate();
  if (!html) return null;
  let meta;
  try {
    meta = await metaFor(urlPath);
  } catch {
    return html; // previews are a nice-to-have: never break the page
  }
  const url = `${env.storeUrl}${urlPath}`;
  const tags = [
    `<meta name="description" content="${esc(meta.description)}">`,
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    meta.image && `<meta property="og:image" content="${esc(absolute(meta.image))}">`,
    meta.price != null && `<meta property="product:price:amount" content="${meta.price}"><meta property="product:price:currency" content="INR">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<link rel="canonical" href="${esc(url.split('?')[0])}">`,
  ].filter(Boolean).join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace('</head>', `    ${tags}\n  </head>`);
}
