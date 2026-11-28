// Installing the app (PWA) and push notifications.
import { get, post, put } from './api';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// ----- install

let installEvent = null;
const installListeners = new Set();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  installListeners.forEach((fn) => fn(true));
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  installListeners.forEach((fn) => fn(false));
});

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => !!installEvent;
export function onInstallChange(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}
export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  installListeners.forEach((fn) => fn(false));
  return outcome === 'accepted';
}

// ----- push

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

const toBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Asks for permission (unless `silent`), subscribes this device and tells the server.
 * Returns 'granted', 'denied', 'default' or 'unsupported'.
 */
export async function enablePush({ silent = false } = {}) {
  if (!pushSupported()) return 'unsupported';
  let perm = Notification.permission;
  if (perm === 'default' && !silent) perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await get('/api/push/key');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
  }
  await post('/api/push/subscribe', {
    endpoint: sub.endpoint,
    p256dh: toB64(sub.getKey('p256dh')),
    auth: toB64(sub.getKey('auth')),
  });
  return 'granted';
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
}

export const sendTestPush = () => post('/api/push/test');

/** Saves reminder settings on the server, which sends the scheduled reminders. */
export const savePushPrefs = (r) => put('/api/push/prefs', {
  daily: r.daily, time: r.time, weekly: r.weekly, weeklyDay: r.weeklyDay || 'fri',
  budget: r.budget, goals: r.goals, quietFrom: r.quietFrom, quietTo: r.quietTo,
});
