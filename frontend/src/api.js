import { localize } from './serverText';
// Thin client for the Ershak REST API. The session token lives in sessionStorage,
// so closing the tab logs the user out.
const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'ershak.token';

export class ApiError extends Error {
  constructor(status, body) {
    super(localize(body?.message || 'Something went wrong. Try again.'));
    this.status = status;
    this.code = body?.code;
    this.body = body || {};
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = 'GET', body, raw = false, passive = false } = {}) {
  const headers = {};
  if (passive) headers['X-Passive'] = '1';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: "Can't reach the server. Check your connection." });
  }
  if (raw && res.ok) return res;
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (res.status === 401 && token && path !== '/api/auth/login') onUnauthorized(err);
    throw err;
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

/** Downloads a file from an authenticated endpoint. */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
