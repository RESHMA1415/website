import { Setting } from '../models/index.js';
import { defaultSettings } from '../config/defaultSettings.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDeep(base[key], value) : value;
  }
  return result;
}

export async function getSettings() {
  const doc = await Setting.findOne({ key: 'business' }).lean();
  return {
    ...mergeDeep(defaultSettings, doc?.values),
    pages: doc?.pages || {},
  };
}

// Only what the customer website is allowed to see
export async function getPublicSettings() {
  const { store, delivery, cod, orders, social, seo } = await getSettings();
  return {
    store,
    delivery,
    cod: { enabled: cod.enabled, charge: cod.charge, maxOrderValue: cod.maxOrderValue },
    orders: { maxQtyPerItem: orders.maxQtyPerItem, returnWindowDays: orders.returnWindowDays },
    social,
    seo,
  };
}

export async function getPage(name) {
  const doc = await Setting.findOne({ key: 'business' }, { [`pages.${name}`]: 1 }).lean();
  return doc?.pages?.[name] || '';
}

// Low-stock alert level for options that don't have their own (Business Settings)
export async function lowStockDefault() {
  return (await getSettings()).orders.lowStockDefault;
}
