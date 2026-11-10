import crypto from 'node:crypto';

// Cloudinary (PRD §14.4): online storage for product photos, review photos and
// videos, and the nightly database backups. Plain fetch with signed uploads, so
// no extra library is needed. Keys come only from backend/.env:
//   CLOUDINARY_URL=cloudinary://<api key>:<api secret>@<cloud name>
// or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
// CLOUDINARY_FOLDER (default "shopme") keeps this store's files together.

function readConfig() {
  const url = (process.env.CLOUDINARY_URL || '').trim();
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  const cloud = m ? m[3] : (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const key = m ? m[1] : (process.env.CLOUDINARY_API_KEY || '').trim();
  const secret = m ? m[2] : (process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = (process.env.CLOUDINARY_FOLDER || 'shopme').trim().replace(/^\/+|\/+$/g, '') || 'shopme';
  return { cloud, key, secret, folder };
}

export function cloudinaryConfigured() {
  const c = readConfig();
  return Boolean(c.cloud && c.key && c.secret);
}

export function cloudinaryFolder() {
  return readConfig().folder;
}

// Cloudinary's signature: SHA-1 of the sorted parameters followed by the secret
export function signParams(params, secret) {
  const text = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(text + secret).digest('hex');
}

async function call(path, form) {
  const { cloud } = readConfig();
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/${path}`, { method: 'POST', body: form });
  let body = {};
  try {
    body = await res.json();
  } catch {
    // not JSON: handled below
  }
  if (!res.ok || body.error) {
    const err = new Error(`Cloudinary ${path} failed (${res.status}): ${body.error?.message || 'no details'}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Delivery address without a version number: our file names are unique, so
// the address never needs to change, and sibling sizes (-large/-medium/-thumb)
// can be worked out from each other.
export function deliveryUrl(resourceType, publicId, format) {
  const { cloud } = readConfig();
  return `https://res.cloudinary.com/${cloud}/${resourceType}/upload/${publicId}${format ? `.${format}` : ''}`;
}

/**
 * Uploads a file. resourceType: image | video | raw. publicId is relative to
 * the store folder. Returns { publicId, url, bytes }.
 */
// type "authenticated" makes a file private: it can only be fetched with a signed link
export async function cloudinaryUpload(buffer, { resourceType = 'image', publicId, format, contentType = 'application/octet-stream', fileName = 'upload', type }) {
  const { key, secret, folder } = readConfig();
  const fullId = `${folder}/${publicId}`;
  const params = { public_id: fullId, timestamp: Math.floor(Date.now() / 1000), overwrite: 'false', type };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), fileName);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) form.append(k, String(v));
  form.append('api_key', key);
  form.append('signature', signParams(params, secret));
  const body = await call(`${resourceType}/upload`, form);
  return { publicId: body.public_id || fullId, url: deliveryUrl(resourceType, body.public_id || fullId, resourceType === 'raw' ? '' : format || body.format), bytes: body.bytes };
}

export async function cloudinaryDestroy(publicId, resourceType = 'image', type) {
  const { key, secret } = readConfig();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), invalidate: 'true', type };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) form.append(k, String(v));
  form.append('api_key', key);
  form.append('signature', signParams(params, secret));
  return call(`${resourceType}/destroy`, form);
}

/** Lists raw files under a prefix (used to prune old backups). Admin API, basic auth. */
export async function cloudinaryListRaw(prefix, { type = 'upload', max = 500 } = {}) {
  const { cloud, key, secret, folder } = readConfig();
  const out = [];
  let cursor;
  do {
    const q = new URLSearchParams({ prefix: `${folder}/${prefix}`, max_results: '100' });
    if (cursor) q.set('next_cursor', cursor);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/resources/raw/${type}?${q}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloudinary list failed (${res.status}): ${body.error?.message || 'no details'}`);
    out.push(...(body.resources || []).map((r) => ({ publicId: r.public_id, createdAt: r.created_at, bytes: r.bytes, url: r.secure_url })));
    cursor = body.next_cursor;
  } while (cursor && out.length < max);
  return out;
}

/** A signed, short-lived download link for a private file (expires in 1 hour). */
export function cloudinaryPrivateDownloadUrl(publicId, { resourceType = 'raw', type = 'authenticated' } = {}) {
  const { cloud, key, secret } = readConfig();
  const params = { public_id: publicId, type, timestamp: Math.floor(Date.now() / 1000), expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: key, signature: signParams(params, secret) });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/${resourceType}/download?${q}`;
}
