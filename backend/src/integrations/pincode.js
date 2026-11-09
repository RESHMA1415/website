// Pincode → city and state (PRD §6.7, §13.8), using India Post's free public
// lookup (api.postalpincode.in). Only the 6-digit pincode is sent: never a name,
// phone or address. Owner approved this service on 9 Nov 2026.
// Answers are remembered for a day; if the service is slow or down, the
// customer simply types the city and state.
import { INDIAN_STATES, PINCODE_PATTERN } from '../utils/india.js';

const API = 'https://api.postalpincode.in/pincode';
const DAY = 24 * 3600 * 1000;
const cache = new Map(); // pincode -> { at, value }

const key = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const STATES = new Map(INDIAN_STATES.map((s) => [key(s), s]));
// Older names some post offices still use
STATES.set(key('Dadra and Nagar Haveli'), 'Dadra and Nagar Haveli and Daman and Diu');
STATES.set(key('Daman and Diu'), 'Dadra and Nagar Haveli and Daman and Diu');
STATES.set(key('Pondicherry'), 'Puducherry');
STATES.set(key('Orissa'), 'Odisha');
STATES.set(key('Uttaranchal'), 'Uttarakhand');

function mostCommon(values) {
  const counts = new Map();
  for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/**
 * Returns { found: true, city, state, areas } or { found: false }.
 * Never throws: a lookup problem must never stop an address being saved.
 */
export async function lookupPincode(pincode) {
  const pin = String(pincode || '').trim();
  if (!PINCODE_PATTERN.test(pin)) return { found: false };
  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < DAY) return hit.value;

  let value;
  try {
    const response = await fetch(`${API}/${pin}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    const [result] = await response.json();
    const offices = result?.Status === 'Success' ? result.PostOffice || [] : [];
    if (!offices.length) {
      value = { found: false };
    } else {
      const state = STATES.get(key(mostCommon(offices.map((o) => o.State)))) || '';
      value = {
        found: true,
        city: mostCommon(offices.map((o) => o.District)),
        state,
        areas: [...new Set(offices.map((o) => o.Name))].slice(0, 20),
      };
    }
  } catch (err) {
    // Service down or slow: don't remember this, try again next time
    console.error(`Pincode lookup for ${pin} failed: ${err.message}`);
    return { found: false, unavailable: true };
  }
  cache.set(pin, { at: Date.now(), value });
  if (cache.size > 20000) cache.clear(); // keep memory bounded
  return value;
}
