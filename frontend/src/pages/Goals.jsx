import { useState } from 'react';
import { del, get, post } from '../api';
import AccountPicker from '../components/AccountPicker';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { AmountInput, Empty, ErrorCard, Proverb, Sheet, Skeleton, useLoader } from '../components/ui';
import { amount, egp } from '../format';
import { Link } from 'react-router-dom';
import { PiggyBank, Sparkles } from 'lucide-react';
import { CatIcon, money, useCatName } from '../coach';
import { useL, usePrefs } from '../prefs';

/** "Ersh 3al ersh": savings goals. */
export default function Goals() {
  const L = useL();
  const goals = useLoader(() => get('/api/goals'));
  const accounts = useLoader(() => get('/api/accounts'));
  const toast = useToast();
  const [sheet, setSheet] = useState(null);
  const { t } = usePrefs();

  const total = (goals.data || []).reduce((s, g) => s + Number(g.savedAmount), 0);
  const refresh = () => {
    goals.reload();
    accounts.reload();
  };

  return (
    <main className="page">
      <div className="between">
        <h1>{t('goals')}</h1>
        <button type="button" className="btn primary sm" onClick={() => setSheet({ kind: 'new' })} disabled={!accounts.data?.length}>
          <Icon name="plus" size={16} stroke={2.2} /> {L('New goal', 'هدف جديد')}
        </button>
      </div>

      <div className="card stack" style={{ gap: 6 }}>
        <p className="small muted">{L('Total saved in goals', 'إجمالي المحوّش في الأهداف')}</p>
        <p className="num" style={{ fontSize: 28, fontWeight: 700 }}>{egp(total)}</p>
      </div>

      {goals.loading && <Skeleton height={140} />}
      {goals.error && <ErrorCard error={goals.error} onRetry={goals.reload} />}
      {goals.data?.length === 0 && (
        <Empty icon="goal" title={L('Start your first goal', 'ابدأ أول هدف')} action={
          <button type="button" className="btn primary" onClick={() => setSheet({ kind: 'new' })} disabled={!accounts.data?.length}>{L('Create a goal', 'اعمل هدف')}</button>}>
          <Proverb>حط القرش عالقرش</Proverb>
          <p className="small muted">{L('A laptop, a trip, an emergency fund. Put money aside and watch it grow.', 'لابتوب، مصيف، فلوس للطوارئ. حوّش وشوفها بتكبر.')}</p>
        </Empty>
      )}

      {goals.data?.map((g) => {
        const done = g.status === 'ACHIEVED';
        return (
          <section key={g.id} className="card stack" style={{ borderColor: done ? 'var(--ok)' : undefined }}>
            <div className="between">
              <div className="row">
                <div className="tx-icon"><Icon name={done ? 'check' : 'goal'} size={20} color={done ? 'var(--ok)' : 'var(--accent)'} stroke={done ? 2.2 : 1.8} /></div>
                <div>
                  <h3>{g.name}</h3>
                  <p className={`tiny ${done ? 'ok' : 'muted'}`}>{done ? L('Goal reached', 'وصلت للهدف') : g.targetDate ? `${L('By', 'قبل')} ${new Date(g.targetDate).toLocaleDateString(L('en-US', 'ar-EG-u-nu-latn'), { month: 'long', year: 'numeric' })}` : L('No deadline', 'من غير ميعاد')}</p>
                </div>
              </div>
              <p className={`num ${done ? 'ok' : ''}`} style={{ fontWeight: 600, color: done ? undefined : 'var(--accent)' }}>{g.progress}%</p>
            </div>
            <div className={`progress${done ? ' ok' : ''}`} role="progressbar" aria-valuenow={g.progress} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${g.progress}%` }} />
            </div>
            <p className="small muted num"><span style={{ color: 'var(--text)', fontWeight: 600 }}>{egp(g.savedAmount)}</span> {L('of', 'من')} {amount(g.targetAmount)}</p>
            {done && <Proverb>حطيت القرش عالقرش ووصلت</Proverb>}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {!done && <button type="button" className="btn sm copper" onClick={() => setSheet({ kind: 'plan', goal: g })}><Sparkles size={15} />{t('plan')}</button>}
              {!done && <button type="button" className="btn sm primary" onClick={() => setSheet({ kind: 'add', goal: g })}>{L('Add money', 'حط فلوس')}</button>}
              {Number(g.savedAmount) > 0 && <button type="button" className="btn sm" onClick={() => setSheet({ kind: 'out', goal: g })}>{L('Move to account', 'رجّعها للحساب')}</button>}
              {Number(g.savedAmount) === 0 && (
                <button type="button" className="btn sm danger" onClick={async () => {
                  try { await del(`/api/goals/${g.id}`); toast(L('Goal deleted.', 'الهدف اتمسح.')); refresh(); } catch (err) { toast(err.message, 'bad'); }
                }}>{L('Delete', 'مسح')}</button>
              )}
            </div>
          </section>
        );
      })}

      <Link to="/zakat" className="card tight row" style={{ color: 'var(--text)' }}>
        <span className="tx-icon"><PiggyBank size={20} color="var(--good)" /></span>
        <div className="tx-main"><p className="small" style={{ fontWeight: 700 }}>{t('zakat')}</p><p className="tiny muted">{t('zakatHint')}</p></div>
      </Link>

      {sheet?.kind === 'plan' && <PlanSheet goal={sheet.goal} onClose={() => setSheet(null)} onAdd={() => setSheet({ kind: 'add', goal: sheet.goal })} />}
      {sheet?.kind === 'new' && <NewGoal accounts={accounts.data} onClose={() => setSheet(null)} onDone={refresh} />}
      {(sheet?.kind === 'add' || sheet?.kind === 'out') && (
        <MoveGoal goal={sheet.goal} mode={sheet.kind} onClose={() => setSheet(null)} onDone={refresh}
          account={accounts.data?.find((a) => a.id === sheet.goal.accountId)} />
      )}
    </main>
  );
}

function NewGoal({ accounts, onClose, onDone }) {
  const L = useL();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '', accountId: accounts?.[0]?.id });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(L('Give your goal a name.', 'سمّي الهدف.'));
    if (!(Number(form.targetAmount) > 0)) return setError(L('Enter a target amount.', 'اكتب المبلغ المطلوب.'));
    setBusy(true);
    try {
      await post('/api/goals', form);
      toast(L('Goal created.', 'الهدف اتعمل. حط القرش عالقرش'));
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={L('New goal', 'هدف جديد')} onClose={onClose}>
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="gname">{L('Name', 'الاسم')}</label>
          <input id="gname" className="input" maxLength={40} placeholder={L('New laptop', 'لابتوب جديد')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="gtarget">{L('Target', 'المبلغ المطلوب')}</label>
          <AmountInput id="gtarget" value={form.targetAmount} onChange={(v) => setForm({ ...form, targetAmount: v })} />
        </div>
        <div className="field">
          <label htmlFor="gdate">{L('Target date (optional)', 'الميعاد (اختياري)')}</label>
          <input id="gdate" type="date" className="input" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        </div>
        <AccountPicker accounts={accounts} value={form.accountId} onChange={(id) => setForm({ ...form, accountId: id })} label={L('Fund it from', 'من حساب')} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? L('Creating…', 'بيتعمل…') : L('Create goal', 'اعمل الهدف')}</button>
      </form>
    </Sheet>
  );
}

function MoveGoal({ goal, mode, account, onClose, onDone }) {
  const L = useL();
  const toast = useToast();
  const adding = mode === 'add';
  const [value, setValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount));

  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(value) > 0)) return setError(L('Enter an amount.', 'اكتب المبلغ.'));
    if (!adding && goal.status !== 'ACHIEVED' && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const g = await post(`/api/goals/${goal.id}/${adding ? 'contribute' : 'withdraw'}`, { amount: value });
      toast(g.status === 'ACHIEVED' && adding ? 'حطيت القرش عالقرش ووصلت' : adding ? L('Saved.', 'اتحوّش.') : L('Moved back to your account.', 'رجعت لحسابك.'));
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={adding ? `${L('Add to', 'حط في')} ${goal.name}` : `${L('Move from', 'رجّع من')} ${goal.name}`} onClose={onClose}>
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="gamount">{L('Amount', 'المبلغ')}</label>
          <AmountInput id="gamount" value={value} onChange={(v) => { setValue(v); setConfirming(false); }} autoFocus />
          <div className="chips">
            {adding && remaining > 0 && <button type="button" className="chip" onClick={() => setValue(String(remaining))}>{L('Finish it', 'كمّله')}: {amount(remaining)}</button>}
            {!adding && <button type="button" className="chip" onClick={() => setValue(String(goal.savedAmount))}>{L('All', 'الكل')}: {amount(goal.savedAmount)}</button>}
          </div>
          <p className="hint">{adding ? `${L('From', 'من')} ${account?.maskedNumber || ''} · ${egp(Number(account?.balance || 0) - Number(account?.holdAmount || 0))} ${L('free', 'متاح')}` : `${L('Back to', 'لـ')} ${account?.maskedNumber || ''}`}</p>
        </div>
        {confirming && (
          <div className="alert" role="alert">
            <Icon name="goal" color="var(--warn)" />
            <p className="small">{L("You haven't reached this goal yet. Move the money anyway?", 'لسه موصلتش للهدف. ترجّع الفلوس برضه؟')}</p>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? L('Working…', 'لحظة…') : confirming ? L('Yes, move it', 'أيوه رجّعها') : adding ? L('Save', 'حوّش') : L('Move to account', 'رجّعها للحساب')}</button>
      </form>
    </Sheet>
  );
}

function PlanSheet({ goal, onClose, onAdd }) {
  const L = useL();
  const { t } = usePrefs();
  const catName = useCatName();
  const plan = useLoader(() => get(`/api/coach/goals/${goal.id}/plan`));
  const p = plan.data;
  return (
    <Sheet title={`${t('plan')} · ${goal.name}`} onClose={onClose}>
      {plan.loading && <Skeleton height={200} />}
      {plan.error && <ErrorCard error={plan.error} onRetry={plan.reload} />}
      {p && (
        <div className="stack-lg">
          <div className="grid-3">
            <div className="inset"><p className="tiny muted">{t('neededMonth')}</p><p className="num" style={{ fontWeight: 700 }}>{money(p.neededPerMonth)}</p></div>
            <div className="inset"><p className="tiny muted">{t('savingNow')}</p><p className="num" style={{ fontWeight: 700 }}>{money(p.savingNow)}</p></div>
            <div className="inset"><p className="tiny muted">{t('gap')}</p><p className={`num ${Number(p.gap) > 0 ? 'bad' : 'good'}`} style={{ fontWeight: 700 }}>{money(p.gap)}</p></div>
          </div>
          <div className="coach">
            <img src="/ershak-coin2.png" alt="" className="coin" />
            <div className="bubble" dir="rtl">{p.message}</div>
          </div>
          {p.cuts.length > 0 && (
            <div className="card list">
              {p.cuts.map((c) => (
                <div key={c.category.id} className="tx" style={{ cursor: 'default' }}>
                  <CatIcon category={c.category} />
                  <div className="tx-main">
                    <p className="tx-title">{t('cutIn')} {catName(c.category)}</p>
                    <p className="tiny muted num">{money(c.monthlyNow)} → {money(c.suggested)}</p>
                  </div>
                  <p className="tx-amount good">+{money(c.saving)}</p>
                </div>
              ))}
              <div className="tx" style={{ cursor: 'default' }}>
                <p className="tx-main small" style={{ fontWeight: 700 }}>{t('total')}</p>
                <p className="tx-amount good">+{money(p.totalCuts)} <span className="tiny muted">{t('perMonth')}</span></p>
              </div>
            </div>
          )}
          <button type="button" className="btn primary block" onClick={onAdd}>{L('Add money', 'حط فلوس')}</button>
        </div>
      )}
    </Sheet>
  );
}
