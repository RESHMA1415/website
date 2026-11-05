// Small wrapper around fetch for the SHOPME API (proxied to the backend in dev).
// Sends the customer's login (if any) and the guest cart id with every call.

const TOKEN_KEY = 'shopme.token';
const GUEST_KEY = 'shopme.guestId';
export const SESSION_ENDED_EVENT = 'shopme:session-ended';

// Browser storage can be blocked (private mode, strict settings): never let that break the shop
function store(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
const read = (kind, key) => {
  try {
    return store(kind)?.getItem(key) || '';
  } catch {
    return '';
  }
};
const write = (kind, key, value) => {
  try {
    if (value) store(kind)?.setItem(key, value);
    else store(kind)?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

// "Remember me" keeps the login in localStorage; otherwise it ends with the browser session
export function getToken() {
  return read('local', TOKEN_KEY) || read('session', TOKEN_KEY);
}
export function setToken(token, remember) {
  write('local', TOKEN_KEY, remember ? token : '');
  write('session', TOKEN_KEY, remember ? '' : token);
}
export function clearToken() {
  write('local', TOKEN_KEY, '');
  write('session', TOKEN_KEY, '');
}
export function isRemembered() {
  return Boolean(read('local', TOKEN_KEY));
}

// A random id for this browser's guest cart (unguessable, so other people can't see it)
let memoryGuestId = '';
export function getGuestId() {
  let id = read('local', GUEST_KEY) || memoryGuestId;
  if (!id) {
    id = (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
    write('local', GUEST_KEY, id);
    memoryGuestId = id;
  }
  return id;
}

export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Guest-Id': getGuestId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // An expired or blocked login: sign out on this device
    if (token && (response.status === 401 || response.status === 403) && !path.startsWith('/auth/login')) {
      clearToken();
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: data.message }));
    }
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
