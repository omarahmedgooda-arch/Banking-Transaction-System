import { createContext, useCallback, useContext, useState } from 'react';
import {
  Bus, CircleDot, Coffee, CreditCard, Gift, GraduationCap, HandHeart, HeartPulse, Home, Receipt, Shirt,
  ShoppingCart, Smartphone, Tag,
} from 'lucide-react';
import { usePrefs } from './prefs';

// Lucide icon per category (names come from the server, see CoachService.DEFAULT_CATEGORIES).
const icons = {
  receipt: Receipt, home: Home, 'shopping-cart': ShoppingCart, bus: Bus, 'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap, 'hand-heart': HandHeart, coffee: Coffee, shirt: Shirt, 'credit-card': CreditCard,
  smartphone: Smartphone, gift: Gift, 'circle-dot': CircleDot,
};

export function CatIcon({ category, size = 38 }) {
  const I = icons[category?.icon] || Tag;
  const color = category?.color || '#64748B';
  return (
    <span className="cat" style={{ width: size, height: size, background: `${color}22`, color }} aria-hidden="true">
      <I size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

export function useCatName() {
  const { ar } = usePrefs();
  return (c) => (c ? (ar ? c.nameAr : c.nameEn) : '');
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const money = (v) => nf.format(Math.round(Number(v || 0) * 100) / 100);

export const monthKey = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`;
};
export const shiftMonth = (key, by) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

export function monthName(key, lang) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function dayLabel(ms, t, lang) {
  const key = (x) => new Date(x).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  if (key(ms) === key(Date.now())) return t('today');
  if (key(ms) === key(Date.now() - 86_400_000)) return t('yesterday');
  return new Date(ms).toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' });
}

// Lets any screen open the quick-add sheet and refresh after a save.
const QuickAddContext = createContext(null);
export function QuickAddProvider({ children }) {
  const [open, setOpen] = useState(null);
  const [version, setVersion] = useState(0);
  const show = useCallback((tab = 'manual') => setOpen(tab), []);
  const hide = useCallback(() => setOpen(null), []);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  return <QuickAddContext.Provider value={{ open, show, hide, version, changed }}>{children}</QuickAddContext.Provider>;
}
export const useQuickAdd = () => useContext(QuickAddContext);
