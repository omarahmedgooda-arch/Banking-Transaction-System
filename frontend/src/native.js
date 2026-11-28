// Android app (Capacitor) features: reading bank SMS and local reminders.
// On the web every function here is a no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = () => Capacitor.isNativePlatform();
const SmsReader = registerPlugin('SmsReader');

// ----- bank SMS

const SEEN_KEY = 'ershak.smsSeen';
const SINCE_KEY = 'ershak.smsSince';
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// A message looks like a bank transaction if it has an amount and a money/card word.
const MONEY = /(egp|le\b|l\.e|جنيه|ج\.م|جم\b)/i;
const ACTION = /(debit|purchase|pos|card|paid|payment|withdraw|خصم|شراء|سحب|دفع|بطاقة|كارت|عملية)/i;
const looksLikeBank = (body = '') => /\d/.test(body) && MONEY.test(body) && ACTION.test(body);

/**
 * New bank messages since the last check (first time: the last 7 days), skipping ones already handled.
 * Asks for the SMS permission the first time.
 */
export async function newBankSms() {
  const since = store.get(SINCE_KEY, Date.now() - 7 * 86_400_000);
  const seen = new Set(store.get(SEEN_KEY, []));
  const { messages } = await SmsReader.list({ since, limit: 200 });
  return messages.filter((m) => !seen.has(m.id) && looksLikeBank(m.body));
}

/** Remembers messages as handled (logged or skipped) so they are not suggested again. */
export function markSmsHandled(ids) {
  const seen = store.get(SEEN_KEY, []);
  store.set(SEEN_KEY, [...new Set([...seen, ...ids])].slice(-1000));
  store.set(SINCE_KEY, Date.now() - 2 * 86_400_000); // keep a small overlap; seen ids prevent repeats
}

export async function smsPermissionGranted() {
  try { return (await SmsReader.status()).granted; } catch { return false; }
}

// ----- local reminders (the app can't receive web push, so it schedules them on the phone)

const DAYS = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

export async function enableLocalReminders(reminder) {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'denied';
  await scheduleLocalReminders(reminder);
  return 'granted';
}

export async function localRemindersGranted() {
  try { return (await LocalNotifications.checkPermissions()).display === 'granted'; } catch { return false; }
}

export async function scheduleLocalReminders(r) {
  await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }] }).catch(() => {});
  const [hour, minute] = (r.time || '21:00').split(':').map(Number);
  const list = [];
  if (r.daily) {
    list.push({
      id: 1, title: 'قرشك', body: 'صرفت كام النهارده؟ سجّلهم في ثانية.',
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true }, extra: { url: '/?add=1' },
    });
  }
  if (r.weekly) {
    list.push({
      id: 2, title: 'ملخص الأسبوع', body: 'تعالى نشوف صرفت كام الأسبوع ده.',
      schedule: { on: { weekday: DAYS[r.weeklyDay || 'fri'], hour, minute }, repeats: true, allowWhileIdle: true },
      extra: { url: '/expenses?tab=insights' },
    });
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

export async function testLocalReminder() {
  await LocalNotifications.schedule({
    notifications: [{ id: 99, title: 'قرشك', body: 'الإشعارات شغالة 👌', schedule: { at: new Date(Date.now() + 3000) } }],
  });
}

/** Opens the right screen when a reminder is tapped. */
export function onReminderTap(navigate) {
  if (!isNative()) return () => {};
  const h = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    navigate(e.notification?.extra?.url || '/');
  });
  return () => { h.then((x) => x.remove()); };
}
