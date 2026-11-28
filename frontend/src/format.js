const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const egp = (v) => `EGP ${money.format(Number(v || 0))}`;
export const amount = (v) => money.format(Number(v || 0));
export const compact = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `EGP ${whole.format(Math.round(n / 1000))}K`;
  return egp(n);
};

export const time = (ms) =>
  new Date(ms).toLocaleTimeString(ar() ? 'ar-EG-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' });

export function day(ms) {
  const d = new Date(ms);
  const opts = { timeZone: 'Africa/Cairo' };
  const key = (x) => x.toLocaleDateString('en-CA', opts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (key(d) === key(today)) return ar() ? 'النهارده' : 'Today';
  if (key(d) === key(yesterday)) return ar() ? 'امبارح' : 'Yesterday';
  return d.toLocaleDateString(ar() ? 'ar-EG-u-nu-latn' : 'en-US', { ...opts, day: 'numeric', month: 'short', year: 'numeric' });
}

export const dateTime = (ms) => `${day(ms)} · ${time(ms)}`;

export const greeting = () => {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Africa/Cairo' }));
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
};

export const firstName = (full = '') => full.split(' ')[0];

const ar = () => document.documentElement.lang === 'ar';
const localized = (en, a) => new Proxy({}, { get: (_, k) => (ar() ? a[k] : en[k]) });
export const typeLabel = localized({ SAVINGS: 'Savings account', CURRENT: 'Current account' }, { SAVINGS: 'حساب توفير', CURRENT: 'حساب جاري' });

export const statusLabel = localized(
  { COMPLETED: 'Completed', PENDING_OTP: 'Waiting for code', PENDING_REVIEW: 'Under review', REJECTED: 'Cancelled', FAILED: 'Failed' },
  { COMPLETED: 'تمت', PENDING_OTP: 'مستني الكود', PENDING_REVIEW: 'تحت المراجعة', REJECTED: 'اتلغت', FAILED: 'فشلت' },
);

export const statusTone = {
  COMPLETED: 'ok',
  PENDING_OTP: 'warn',
  PENDING_REVIEW: 'warn',
  REJECTED: 'bad',
  FAILED: 'bad',
};

export const groupByDay = (items) => {
  const groups = [];
  for (const it of items) {
    const label = day(it.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
};
