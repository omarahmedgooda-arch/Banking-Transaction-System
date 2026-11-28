import { useEffect, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { post } from '../api';
import { CatIcon, dayLabel, money, useCatName, useQuickAdd } from '../coach';
import { markSmsHandled, newBankSms } from '../native';
import { usePrefs } from '../prefs';
import { useToast } from './Toast';

const isoDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

/** Android only: turns new bank SMS into suggested expenses the customer confirms. */
export default function SmsSheet({ onClose }) {
  const { lang, ar } = usePrefs();
  const t = (a, e) => (ar ? a : e);
  const { t: tr } = usePrefs();
  const catName = useCatName();
  const toast = useToast();
  const { changed } = useQuickAdd();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const msgs = await newBankSms();
        const out = [];
        for (const m of msgs) {
          try {
            const s = await post('/api/coach/sms', { text: m.body });
            out.push({ ...m, s, on: !!(s.amount && s.debit) });
          } catch {
            out.push({ ...m, s: null, on: false });
          }
        }
        setItems(out);
      } catch (e) {
        setError(e?.code === 'DENIED' || /denied/i.test(e?.message || '')
          ? t('محتاج إذن قراية الرسايل علشان أقدر أساعدك. فعّله من إعدادات الموبايل ← التطبيقات ← قرشك ← الأذونات.', 'Ershak needs SMS permission. Turn it on in Settings → Apps → Ershak → Permissions.')
          : e.message);
        setItems([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usable = (items || []).filter((x) => x.s?.amount && x.s.debit);
  const chosen = usable.filter((x) => x.on);

  const save = async () => {
    setBusy(true);
    let ok = 0;
    for (const x of chosen) {
      try {
        await post('/api/coach/expenses', {
          categoryId: x.s.category.id, amount: String(x.s.amount), merchant: x.s.merchant || null,
          note: null, source: 'SMS', date: isoDay(x.date),
        });
        ok += 1;
      } catch { /* keep going */ }
    }
    markSmsHandled(items.map((x) => x.id));
    changed();
    toast(t(`اتسجل ${ok} مصروف من رسايل البنك`, `${ok} expenses logged from bank SMS`));
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('رسايل البنك', 'Bank SMS')} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>{t('رسايل البنك الجديدة', 'New bank messages')}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {items === null && <p className="small muted">{tr('loading')}</p>}
        {error && <div className="alert bad small">{error}</div>}
        {items && !error && usable.length === 0 && (
          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <MessageSquareText size={32} color="var(--muted)" />
            <p className="small">{t('مفيش رسايل صرف جديدة من البنك.', 'No new spending messages from your bank.')}</p>
          </div>
        )}
        {usable.length > 0 && (
          <div className="card list">
            {usable.map((x) => (
              <label key={x.id} className="tx" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={x.on} onChange={() => setItems((xs) => xs.map((y) => (y.id === x.id ? { ...y, on: !y.on } : y)))}
                  style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
                <CatIcon category={x.s.category} />
                <div className="tx-main">
                  <p className="tx-title" dir="auto">{x.s.merchant || catName(x.s.category)}</p>
                  <p className="tiny muted">{catName(x.s.category)} · {dayLabel(x.date, tr, lang)}</p>
                </div>
                <p className="tx-amount">-{money(x.s.amount)}</p>
              </label>
            ))}
          </div>
        )}
        <p className="tiny muted">{t('بنقرا رسايل البنك بس، ومفيش حاجة بتتسجّل غير اللي إنت بتختاره.', 'Only bank messages are read, and only what you pick is logged.')}</p>
        {usable.length > 0 && (
          <button type="button" className="btn primary block" disabled={busy || !chosen.length} onClick={save}>
            {t(`سجّل ${chosen.length} مصروف`, `Log ${chosen.length} expenses`)}
          </button>
        )}
        {items && usable.length === 0 && items.length > 0 && (
          <button type="button" className="btn block" onClick={() => { markSmsHandled(items.map((x) => x.id)); onClose(); }}>{t('تمام', 'OK')}</button>
        )}
      </div>
    </div>
  );
}
