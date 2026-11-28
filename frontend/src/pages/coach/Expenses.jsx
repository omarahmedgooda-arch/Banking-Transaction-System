import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lightbulb, MessageSquareText, Camera, Search, Trash2, X } from 'lucide-react';
import { del, get, put } from '../../api';
import { CatIcon, dayLabel, money, monthKey, monthName, shiftMonth, useCatName, useQuickAdd } from '../../coach';
import { ErrorCard, Skeleton, useLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { usePrefs } from '../../prefs';

export function MonthSwitcher({ month, setMonth }) {
  const { lang, ar } = usePrefs();
  const Prev = ar ? ChevronRight : ChevronLeft;
  const Next = ar ? ChevronLeft : ChevronRight;
  const atNow = month >= monthKey();
  return (
    <div className="between card tight" style={{ padding: '6px 8px' }}>
      <button type="button" className="icon-btn" style={{ border: 0 }} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><Prev size={20} /></button>
      <span style={{ fontWeight: 700 }}>{monthName(month, lang)}</span>
      <button type="button" className="icon-btn" style={{ border: 0, opacity: atNow ? 0.3 : 1 }} disabled={atNow} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><Next size={20} /></button>
    </div>
  );
}

export default function Expenses() {
  const { t } = usePrefs();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(monthKey());
  const tab = params.get('tab') === 'insights' ? 'insights' : 'list';
  const setTab = (v) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', v); return n; }, { replace: true });

  return (
    <main className="page">
      <h1>{t('expenses')}</h1>
      <MonthSwitcher month={month} setMonth={setMonth} />
      <div className="seg">
        <button type="button" className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>{t('list')}</button>
        <button type="button" className={tab === 'insights' ? 'on' : ''} onClick={() => setTab('insights')}>{t('insights')}</button>
      </div>
      {tab === 'list' ? <ExpenseList month={month} initialCat={params.get('cat')} /> : <Insights month={month} />}
    </main>
  );
}

const srcIcon = { SMS: MessageSquareText, RECEIPT: Camera };

function ExpenseList({ month, initialCat }) {
  const { t, lang } = usePrefs();
  const catName = useCatName();
  const toast = useToast();
  const { version, show, changed } = useQuickAdd();
  const list = useLoader(() => get(`/api/coach/expenses?month=${month}`), [month, version]);
  const [filter, setFilter] = useState(initialCat ? `c${initialCat}` : 'all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const items = useMemo(() => (list.data || []).filter((e) => {
    if (filter === 'ess' && !e.category.essential) return false;
    if (filter === 'non' && e.category.essential) return false;
    if (filter.startsWith('c') && String(e.category.id) !== filter.slice(1)) return false;
    if (q) {
      const s = `${e.note || ''} ${e.merchant || ''} ${e.category.nameAr} ${e.category.nameEn}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [list.data, filter, q]);

  const groups = useMemo(() => {
    const out = [];
    for (const e of items) {
      const label = dayLabel(e.spentAt, t, lang);
      const last = out[out.length - 1];
      if (last && last.label === label) { last.items.push(e); last.sum += Number(e.amount); } else out.push({ label, items: [e], sum: Number(e.amount) });
    }
    return out;
  }, [items, t, lang]);

  const usedCats = useMemo(() => {
    const m = new Map();
    (list.data || []).forEach((e) => m.set(e.category.id, e.category));
    return [...m.values()];
  }, [list.data]);
  const total = items.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <div className="row card tight" style={{ padding: '0 12px' }}>
        <Search size={18} color="var(--muted)" />
        <input className="input" style={{ border: 0, boxShadow: 'none', paddingInline: 4 }} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} dir="auto" />
        {q && <button type="button" className="link-btn" aria-label="Clear" onClick={() => setQ('')}><X size={16} /></button>}
      </div>
      <div className="chips scroll">
        {[['all', t('all')], ['ess', t('essential')], ['non', t('nonEssential')]].map(([k, l]) => (
          <button key={k} type="button" className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
        {usedCats.map((c) => (
          <button key={c.id} type="button" className={`chip${filter === `c${c.id}` ? ' on' : ''}`} onClick={() => setFilter(`c${c.id}`)}>{catName(c)}</button>
        ))}
      </div>

      {list.loading && !list.data && <Skeleton height={260} />}
      {list.error && <ErrorCard error={list.error} onRetry={list.reload} />}
      {list.data && (
        <div className="between small"><span className="muted">{t('total')}</span><span className="num" style={{ fontWeight: 700 }}>{money(total)} {t('egp')}</span></div>
      )}
      {list.data && items.length === 0 && (
        <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <img src="/ershak-coin2.png" alt="" className="coin" style={{ width: 52, height: 52 }} />
          <h3>{t('noExpenses')}</h3>
          <button type="button" className="btn primary sm" onClick={() => show()}>{t('add')}</button>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="stack" style={{ gap: 6 }}>
          <div className="day-head"><span>{g.label}</span><span className="num">{money(g.sum)}</span></div>
          <div className="card list">
            {g.items.map((e) => {
              const Src = srcIcon[e.source];
              return (
                <button key={e.id} type="button" className="tx" onClick={() => setEditing(e)}>
                  <CatIcon category={e.category} />
                  <div className="tx-main">
                    <p className="tx-title" dir="auto">{e.note || e.merchant || catName(e.category)}</p>
                    <p className="tiny muted row" style={{ gap: 4 }}>{Src && <Src size={12} />}{catName(e.category)}{e.merchant && e.note ? ` · ${e.merchant}` : ''}</p>
                  </div>
                  <p className="tx-amount">-{money(e.amount)}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {editing && (
        <EditExpense expense={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); changed(); }}
          onDeleted={() => { setEditing(null); changed(); toast(t('deleted')); }} />
      )}
    </>
  );
}

function EditExpense({ expense, onClose, onSaved, onDeleted }) {
  const { t } = usePrefs();
  const catName = useCatName();
  const cats = useLoader(() => get('/api/coach/categories'));
  const [form, setForm] = useState({
    amount: String(Number(expense.amount)), categoryId: expense.category.id, note: expense.note || '', merchant: expense.merchant || '',
    date: new Date(expense.spentAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
  });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(form.amount) > 0)) return setError(t('enterAmount'));
    setBusy(true);
    try { await put(`/api/coach/expenses/${expense.id}`, { ...form, note: form.note || null, merchant: form.merchant || null }); onSaved(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await del(`/api/coach/expenses/${expense.id}`); onDeleted(); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('edit')} onClick={(e) => e.stopPropagation()}>
        <div className="between"><h2>{t('edit')}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="field">
          <label htmlFor="eamt">{t('amount')}</label>
          <input id="eamt" className="input amount" inputMode="decimal" value={form.amount}
            onChange={(e) => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^\d{0,7}(\.\d{0,2})?$/.test(v)) setForm({ ...form, amount: v }); }} />
        </div>
        <div className="field">
          <label htmlFor="ecat">{t('category')}</label>
          <select id="ecat" className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
            {(cats.data || [expense.category]).map((c) => <option key={c.id} value={c.id}>{catName(c)}</option>)}
          </select>
        </div>
        <div className="grid-2">
          <input className="input" dir="auto" maxLength={80} placeholder={t('note')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label={t('date')} />
        </div>
        {error && <p className="error-text">{error}</p>}
        {confirm ? (
          <div className="alert bad stack">
            <p className="small">{t('confirmDelete')}</p>
            <div className="grid-2">
              <button type="button" className="btn sm" onClick={() => setConfirm(false)}>{t('cancel')}</button>
              <button type="button" className="btn sm danger" disabled={busy} onClick={remove}>{t('yes')}</button>
            </div>
          </div>
        ) : (
          <div className="grid-2">
            <button type="button" className="btn danger" onClick={() => setConfirm(true)}><Trash2 size={16} />{t('delete')}</button>
            <button type="button" className="btn primary" disabled={busy} onClick={save}>{t('save')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Insights({ month }) {
  const { t } = usePrefs();
  const catName = useCatName();
  const { version } = useQuickAdd();
  const ins = useLoader(() => get(`/api/coach/insights?month=${month}`), [month, version]);
  if (ins.loading && !ins.data) return <Skeleton height={320} />;
  if (ins.error) return <ErrorCard error={ins.error} onRetry={ins.reload} />;
  const { overview: o, weeks, personality, observations, previousMonthSpent } = ins.data;
  const spent = Number(o.spent);
  const ess = Number(o.essential); const non = Number(o.nonEssential);
  const essPct = spent ? Math.round((ess / spent) * 100) : 0;
  const maxW = Math.max(1, ...weeks.map((w) => Number(w.total)));
  const prev = Number(previousMonthSpent || 0);
  const diff = prev ? Math.round(((spent - prev) / prev) * 100) : null;

  return (
    <div className="desk-2">
      <div className="stack-lg">
        <section className="card stack">
          <div className="between">
            <span className="small muted">{t('spentOfBudget')}</span>
            <span className="num" style={{ fontWeight: 700 }}>{money(spent)}{Number(o.budget) > 0 && <span className="muted small"> / {money(o.budget)}</span>}</span>
          </div>
          {spent > 0 && (
            <>
              <div className="split" aria-hidden="true">
                <div style={{ width: `${essPct}%`, background: 'var(--good)' }} />
                <div style={{ width: `${100 - essPct}%`, background: 'var(--danger)' }} />
              </div>
              <div className="between tiny">
                <span className="good">{t('essential')} <span className="num">{essPct}% · {money(ess)}</span></span>
                <span className="bad">{t('nonEssential')} <span className="num">{100 - essPct}% · {money(non)}</span></span>
              </div>
            </>
          )}
        </section>

        {personality && (
          <section className="card navy stack" style={{ gap: 6 }}>
            <p className="tiny muted">{t('personality')}</p>
            <h2 dir="rtl">{personality.title}</h2>
            <p className="small" dir="rtl" style={{ opacity: 0.9 }}>{personality.description}</p>
          </section>
        )}

        {weeks.length > 0 && (
          <section className="card stack">
            <h3>{t('weekly')}</h3>
            <div className="bars">
              {weeks.map((w) => (
                <div key={w.label}>
                  <span className="tiny num">{money(w.total)}</span>
                  <div className={`bar${Number(w.total) === maxW ? ' top' : ''}`} style={{ height: `${(Number(w.total) / maxW) * 80}%` }} />
                  <span className="tiny muted">{w.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="stack-lg">
        {observations?.length > 0 && (
          <section className="stack">
            <h2>{t('noticed')}</h2>
            {observations.map((x) => (
              <div key={x} className="coach">
                <span className="tx-icon" style={{ background: 'color-mix(in srgb, var(--copper) 18%, transparent)' }}><Lightbulb size={18} color="var(--copper-text)" /></span>
                <div className="bubble" dir="rtl">{x}</div>
              </div>
            ))}
          </section>
        )}

        {o.categories.length > 0 && (
          <section className="stack">
            <h2>{t('byCategory')}</h2>
            <div className="card list">
              {o.categories.map((c) => (
                <div key={c.category.id} className="tx" style={{ cursor: 'default' }}>
                  <CatIcon category={c.category} />
                  <div className="tx-main stack" style={{ gap: 4 }}>
                    <div className="between"><p className="tx-title">{catName(c.category)}</p><p className="tx-amount">{money(c.total)}</p></div>
                    <div className="progress" style={{ height: 6 }}><div style={{ width: `${Number(c.percent)}%`, background: c.category.color }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {prev > 0 && (
          <section className="card stack" style={{ gap: 6 }}>
            <h3>{t('vsLast')}</h3>
            <div className="between small"><span className="muted">{t('lastMonth')}</span><span className="num">{money(prev)}</span></div>
            <div className="between small"><span className="muted">{t('thisMonth')}</span><span className="num">{money(spent)}</span></div>
            {diff !== null && <p className={`small ${diff > 0 ? 'bad' : 'good'}`} style={{ fontWeight: 700 }}><span className="num">{diff > 0 ? '+' : ''}{diff}%</span></p>}
          </section>
        )}
      </div>
    </div>
  );
}
