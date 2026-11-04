import { useCallback, useEffect, useState } from 'react';

// The admin login token. Kept in this browser only; it expires after 2 hours
// without activity (the server hands out a fresh one while you work).
const TOKEN_KEY = 'shopme.admin.token';
const REFRESH_HEADER = 'X-Admin-Token';
export const SESSION_ENDED_EVENT = 'shopme:session-ended';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the login lasts until the page is closed
  }
}

async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const token = getToken();
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && !isForm && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm || typeof body === 'string' ? body : JSON.stringify(body),
  });

  const fresh = response.headers.get(REFRESH_HEADER);
  if (fresh) setToken(fresh);

  if (response.status === 401 && path.startsWith('/admin') && path !== '/admin/auth/login') {
    setToken('');
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  }
  if (raw && response.ok) return response;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

export const api = (path, options) => request(path, options);

// Downloads a file (e.g. inventory CSV) using the admin login
export async function downloadFile(path, fallbackName) {
  const response = await request(path, { raw: true });
  const blob = await response.blob();
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = match?.[1] || fallbackName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Loads data and re-loads when `path` changes; `reload()` fetches again
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    request(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState((s) => ({ data: s.data, loading: false, error })));
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

// "Navy / M" or "Ruby Red / 4 g"
export function optionLabel(options = {}) {
  return [options.colour, options.size, options.shade, options.volume].filter(Boolean).join(' / ');
}

export function formatINR(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function discountPercent(mrp, price) {
  const m = Number(mrp);
  const p = Number(price);
  return m > 0 && p > 0 && p < m ? Math.floor(((m - p) / m) * 100) : 0;
}

// The customer website address (for "View on store" links)
export const STORE_URL = import.meta.env.VITE_STORE_URL || 'http://localhost:5173';
