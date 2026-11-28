import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandCoins } from 'lucide-react';
import { get, post, put } from '../../api';
import { money, monthKey, useQuickAdd } from '../../coach';
import { TopBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { usePrefs } from '../../prefs';

const clean = (v) => { const s = v.replace(/,/g, ''); return s === '' || /^\d{0,9}(\.\d{0,2})?$/.test(s) ? s : null; };

export function Budget() {
  const { t } = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const { changed } = useQuickAdd();
  const [value, setValue] = useState('');
  const [suggest, setSuggest] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/api/coach/overview').then((o) => Number(o.budget) > 0 && setValue(String(Number(o.budget)))).catch(() => {});
    get('/api/coach/insights').then((i) => {
      const prev = Number(i.previousMonthSpent || 0);
      if (prev > 0) setSuggest(Math.ceil((prev * 1.05) / 500) * 500);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!(Number(value) > 0)) return;
    setBusy(true);
    try {
      await put('/api/coach/budget', { month: monthKey(), amount: value });
      toast(t('budgetSaved')); changed(); navigate(-1);
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <main className="page narrow">
      <TopBar title={t('budget')} />
      <div className="card stack-lg">
        <div className="field">
          <label htmlFor="bud">{t('monthlyBudget')}</label>
          <input id="bud" className="input amount" inputMode="decimal" value={value} onChange={(e) => { const v = clean(e.target.value); if (v !== null) setValue(v); }} autoFocus />
        </div>
        <div className="chips">
          {[5000, 9000, 15000].map((n) => <button key={n} type="button" className="chip num" onClick={() => setValue(String(n))}>{money(n)}</button>)}
        </div>
        {suggest && (
          <button type="button" className="coach" style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer' }} onClick={() => setValue(String(suggest))}>
            <img src="/ershak-coin2.png" alt="" className="coin" />
            <span className="bubble" dir="rtl">الشهر اللي فات صرفت قريب من ده، فأنا شايف {money(suggest)} ميزانية واقعية. دوس هنا لو موافق.</span>
          </button>
        )}
        <p className="hint">الميزانية بتتنقل للشهور الجاية لوحدها لحد ما تغيّرها.</p>
        <button type="button" className="btn primary block" disabled={busy || !(Number(value) > 0)} onClick={save}>{t('save')}</button>
      </div>
    </main>
  );
}

const NISAB_GRAMS = 85;

export function Zakat() {
  const { t } = usePrefs();
  const toast = useToast();
  const { changed } = useQuickAdd();
  const [f, setF] = useState({ savings: '', cash: '', gold: '', goldPrice: '', other: '', debts: '' });
  useEffect(() => {
    get('/api/accounts').then((as) => {
      const s = as.filter((a) => a.type === 'SAVINGS').reduce((x, a) => x + Number(a.availableBalance), 0);
      if (s > 0) setF((p) => ({ ...p, savings: String(Math.round(s)) }));
    }).catch(() => {});
  }, []);
  const n = (k) => Number(f[k] || 0);
  const price = n('goldPrice');
  const wealth = n('savings') + n('cash') + n('other') + n('gold') * price - n('debts');
  const nisab = NISAB_GRAMS * price;
  const due = price > 0 && wealth >= nisab;
  const zakat = due ? wealth * 0.025 : 0;
  const set = (k) => (e) => { const v = clean(e.target.value); if (v !== null) setF({ ...f, [k]: v }); };

  const addAsExpense = async () => {
    try {
      const cats = await get('/api/coach/categories');
      const charity = cats.find((c) => c.code === 'charity');
      await post('/api/coach/expenses', { categoryId: charity.id, amount: zakat.toFixed(2), note: 'زكاة المال', source: 'MANUAL' });
      changed(); toast(t('saved'));
    } catch (e) { toast(e.message, 'bad'); }
  };

  const fields = [
    ['savings', 'المدخرات (حساب التوفير)'], ['cash', 'كاش في البيت'], ['other', 'فلوس تانية (شهادات بدون فوايد، فلوس لك عند حد)'],
    ['gold', 'دهب (بالجرام، عيار 24 أو حوّله)'], ['goldPrice', 'سعر جرام الدهب النهارده'], ['debts', 'ديون عليك مستحقة (بتتخصم)'],
  ];

  return (
    <main className="page narrow">
      <TopBar title={t('zakat')} />
      <div className="card stack">
        {fields.map(([k, label]) => (
          <div key={k} className="field">
            <label htmlFor={`z-${k}`}>{label}</label>
            <input id={`z-${k}`} className="input num" inputMode="decimal" placeholder="0" value={f[k]} onChange={set(k)} style={{ textAlign: 'start' }} />
          </div>
        ))}
        <p className="hint">سعر الدهب بتكتبه إنت من مصدر موثوق، علشان مفيش مصدر مجاني ثابت.</p>
      </div>
      <section className={`card stack ${due ? 'navy' : ''}`}>
        <div className="between small"><span className={due ? 'muted' : 'muted'}>النصاب (85 جرام دهب)</span><span className="num">{price ? money(nisab) : '—'}</span></div>
        <div className="between small"><span className="muted">صافي اللي عندك</span><span className="num">{money(wealth)}</span></div>
        <hr className="divider" style={{ opacity: 0.3 }} />
        {!price && <p className="small">اكتب سعر جرام الدهب علشان نحسب النصاب.</p>}
        {price > 0 && !due && <p className="small">فلوسك أقل من النصاب، فمفيش عليك زكاة مال دلوقتي.</p>}
        {due && (
          <>
            <p className="small muted">زكاتك (2.5%)</p>
            <p className="big-amount num">{money(zakat)} <span className="small muted">{t('egp')}</span></p>
            <button type="button" className="btn copper" onClick={addAsExpense}><HandCoins size={18} />سجّلها كمصروف صدقة وزكاة</button>
          </>
        )}
      </section>
      <p className="tiny muted">الحاسبة دي تقريبية وبتفترض إن الفلوس عدّى عليها سنة هجرية. للتأكيد ارجع لأهل العلم.</p>
    </main>
  );
}
