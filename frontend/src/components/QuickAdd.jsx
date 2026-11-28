import { useEffect, useMemo, useState } from 'react';
import { Camera, Delete, ImagePlus, Loader2, MessageSquareText, PenLine, ShieldCheck, X } from 'lucide-react';
import { del, get, post } from '../api';
import { CatIcon, money, todayIso, useCatName, useQuickAdd } from '../coach';
import { usePrefs } from '../prefs';
import { useToast } from './Toast';

const RECENT_KEY = 'ershak.recentCats';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const pushRecent = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 8))); } catch { /* ignore */ } };

/** Shrinks a photo to at most 1600px and re-encodes it as JPEG, so uploads stay small. */
async function shrink(file) {
  // A data: URL, not a blob: one — the server's Content-Security-Policy only allows data: images.
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** The + sheet: log an expense in a few seconds — by hand, from a receipt, or from a bank SMS. */
export default function QuickAdd() {
  const { open, hide, changed } = useQuickAdd();
  const { t } = usePrefs();
  const toast = useToast();
  const catName = useCatName();
  const [tab, setTab] = useState('manual');
  const [cats, setCats] = useState([]);
  const [recentExp, setRecentExp] = useState([]);
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState(null);
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(todayIso());
  const [source, setSource] = useState('MANUAL');
  const [showAll, setShowAll] = useState(false);
  const [sms, setSms] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    setTab(open); setAmount(''); setCatId(null); setNote(''); setMerchant(''); setDate(todayIso());
    setSource('MANUAL'); setShowAll(false); setSms(''); setError(''); setItems([]);
    get('/api/coach/ai').then((r) => setAi(!!r.enabled)).catch(() => setAi(false));
    get('/api/coach/categories').then(setCats).catch(() => {});
    get('/api/coach/expenses').then((xs) => setRecentExp(xs)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  const ordered = useMemo(() => {
    const recent = readRecent();
    return [...cats].sort((a, b) => {
      const ra = recent.indexOf(a.id); const rb = recent.indexOf(b.id);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.sortOrder - b.sortOrder;
    });
  }, [cats]);
  const shown = showAll ? ordered : ordered.slice(0, 8);
  const selected = cats.find((c) => c.id === catId);

  // Repeat buttons: the 3 most frequent amount+category pairs.
  const repeats = useMemo(() => {
    const m = new Map();
    for (const e of recentExp) {
      const k = `${e.category?.id}|${Number(e.amount)}`;
      const cur = m.get(k) || { count: 0, e };
      cur.count += 1;
      m.set(k, cur);
    }
    return [...m.values()].filter((x) => x.count > 1).sort((a, b) => b.count - a.count).slice(0, 3).map((x) => x.e);
  }, [recentExp]);

  if (!open) return null;

  const key = (k) => {
    setError('');
    if (k === 'del') return setAmount((a) => a.slice(0, -1));
    if (k === '.' && (amount.includes('.') || !amount)) return null;
    if (/\.\d\d$/.test(amount) || amount.replace('.', '').length >= 7) return null;
    return setAmount((a) => (a === '0' && k !== '.' ? k : a + k));
  };

  const save = async (override) => {
    const body = override || { categoryId: catId, amount, note: note.trim() || null, merchant: merchant.trim() || null, source, date };
    if (!(Number(body.amount) > 0)) return setError(t('enterAmount'));
    if (!body.categoryId) return setError(t('chooseCategory'));
    setBusy(true);
    try {
      const res = await post('/api/coach/expenses', body);
      pushRecent(body.categoryId);
      if (navigator.vibrate) navigator.vibrate(15);
      toast(`${t('saved')} · ${money(body.amount)}`, 'ok', {
        label: t('undo'),
        onClick: async () => { try { await del(`/api/coach/expenses/${res.expense.id}`); changed(); } catch { /* ignore */ } },
      });
      res.alerts?.forEach((a, i) => setTimeout(() => toast(a, 'ok'), 900 * (i + 1)));
      changed();
      hide();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const readSms = async () => {
    setError('');
    if (!sms.trim()) return setError(t('pasteSms'));
    setBusy(true);
    try {
      const r = await post('/api/coach/sms', { text: sms });
      if (!r.amount) setError(t('smsNone'));
      else if (!r.debit) setError(t('smsIncome'));
      else {
        setAmount(String(Number(r.amount)));
        setMerchant(r.merchant || '');
        setCatId(r.category?.id || null);
        setSource('SMS');
        setTab('manual');
      }
    } catch (err) {
      setError(err.status === 400 || err.status === 422 ? t('smsNone') : err.message);
    } finally {
      setBusy(false);
    }
  };

  const readReceipt = async (file) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const image = await shrink(file);
      const r = await post('/api/coach/receipt', { image, mimeType: 'image/jpeg' });
      setAmount(String(Number(r.total)));
      setMerchant(r.merchant || '');
      setCatId(cats.find((c) => c.code === r.categoryCode)?.id || null);
      if (r.date && r.date <= todayIso()) setDate(r.date);
      setItems(r.items || []);
      setSource('RECEIPT');
      setTab('manual');
    } catch (err) {
      if (err.code === 'AI_OFF') setAi(false);
      setError(err.code === 'NOT_A_RECEIPT' || !err.status ? t('receiptFail') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={hide}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('add')} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>{t('add')}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={hide}><X size={18} /></button>
        </div>

        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'manual'} className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}><PenLine size={15} />{t('manual')}</button>
          <button type="button" role="tab" aria-selected={tab === 'receipt'} className={tab === 'receipt' ? 'on' : ''} onClick={() => setTab('receipt')}><Camera size={15} />{t('receipt')}</button>
          <button type="button" role="tab" aria-selected={tab === 'sms'} className={tab === 'sms' ? 'on' : ''} onClick={() => setTab('sms')}><MessageSquareText size={15} />{t('sms')}</button>
        </div>

        {tab === 'sms' && (
          <div className="stack">
            <textarea className="input" dir="auto" rows={4} placeholder={t('pasteSms')} value={sms} onChange={(e) => setSms(e.target.value)} />
            {error && <p className="error-text">{error}</p>}
            <button type="button" className="btn primary block" disabled={busy} onClick={readSms}>{t('readSms')}</button>
          </div>
        )}

        {tab === 'receipt' && (
          <div className="stack">
            {ai ? (
              <>
                <label className="illus" style={{ aspectRatio: 1.8, cursor: busy ? 'wait' : 'pointer', flexDirection: 'column', gap: 8 }}>
                  {busy ? <Loader2 size={40} color="var(--copper)" className="spin" /> : <Camera size={42} color="var(--copper)" />}
                  <span className="small" style={{ fontWeight: 700 }}>{busy ? t('reading') : t('takePhoto')}</span>
                  <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => readReceipt(e.target.files?.[0])} />
                </label>
                <label className="btn block" style={{ cursor: 'pointer' }}>
                  <ImagePlus size={18} />{t('fromGallery')}
                  <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => readReceipt(e.target.files?.[0])} />
                </label>
              </>
            ) : (
              <>
                <div className="illus" style={{ aspectRatio: 1.8 }}><Camera size={42} color="var(--muted)" /></div>
                <p className="small">{t('receiptSoon')}</p>
              </>
            )}
            {error && <p className="error-text" role="alert">{error}</p>}
            <p className="tiny muted row" style={{ gap: 6 }}><ShieldCheck size={14} />{t('privacy')}</p>
            {!ai && <button type="button" className="btn block" onClick={() => { setSource('RECEIPT'); setTab('manual'); }}>{t('manual')}</button>}
          </div>
        )}

        {tab === 'manual' && (
          <>
            <div style={{ textAlign: 'center' }}>
              <p className="tiny muted">{t('amount')}</p>
              <p className="big-amount num" aria-live="polite">{amount || '0'} <span className="small muted">{t('egp')}</span></p>
              {merchant && <p className="tiny muted">{merchant}</p>}
              {items.length > 0 && (
                <details className="tiny muted" style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer' }}>{t('receiptItems', items.length)}</summary>
                  <div className="inset stack" style={{ gap: 2, marginTop: 6, textAlign: 'start' }}>
                    {items.map((it, i) => <div key={i} className="between"><span>{it.name}</span><span className="num">{money(it.price)}</span></div>)}
                  </div>
                </details>
              )}
            </div>

            {repeats.length > 0 && !amount && (
              <div className="chips scroll" aria-label={t('likeYesterday')}>
                {repeats.map((e) => (
                  <button key={e.id} type="button" className="chip" disabled={busy}
                    onClick={() => save({ categoryId: e.category.id, amount: String(e.amount), note: e.note, merchant: e.merchant, source: 'MANUAL', date: todayIso() })}>
                    <CatIcon category={e.category} size={22} /> {e.note || catName(e.category)} · <span className="num">{money(e.amount)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="cat-grid" role="radiogroup" aria-label={t('category')}>
              {shown.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={catId === c.id} className={`cat-pick${catId === c.id ? ' on' : ''}`}
                  onClick={() => { setCatId(c.id); setError(''); }}>
                  <CatIcon category={c} size={34} />
                  {catName(c)}
                </button>
              ))}
            </div>
            {!showAll && ordered.length > 8 && <button type="button" className="link-btn" onClick={() => setShowAll(true)}>{t('allCategories')}</button>}
            {selected && (
              <p className="tiny row" style={{ gap: 6 }}>
                <span className={`badge ${selected.essential ? 'ok' : 'bad'}`}>{selected.essential ? t('essential') : t('nonEssential')}</span>
              </p>
            )}

            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
                <button key={k} type="button" onClick={() => key(k)} aria-label={k === 'del' ? 'Delete' : k}>
                  {k === 'del' ? <Delete size={20} /> : k}
                </button>
              ))}
            </div>

            <div className="grid-2">
              <input className="input" dir="auto" maxLength={80} placeholder={t('note')} value={note} onChange={(e) => setNote(e.target.value)} />
              <input className="input" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('date')} />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button type="button" className="btn primary block" disabled={busy} onClick={() => save()}>{t('save')}</button>
          </>
        )}
      </div>
    </div>
  );
}
