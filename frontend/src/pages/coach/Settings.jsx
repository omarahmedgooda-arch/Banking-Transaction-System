import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Bell, ChevronLeft, ChevronRight, KeyRound, Languages, LogOut, Moon, PiggyBank, Receipt, Target, UserRound, Wallet } from 'lucide-react';
import { put } from '../../api';
import { useAuth } from '../../auth';
import { monthKey, money } from '../../coach';
import { TopBar } from '../../components/ui';
import { usePrefs } from '../../prefs';

function Row({ icon: I, label, children, to }) {
  const { ar } = usePrefs();
  const Chev = ar ? ChevronLeft : ChevronRight;
  const inner = (
    <>
      <span className="tx-icon"><I size={19} color="var(--primary-text)" /></span>
      <span className="tx-main small" style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {to && <Chev size={18} color="var(--muted)" />}
    </>
  );
  return to ? <Link to={to} className="tx">{inner}</Link> : <div className="tx" style={{ cursor: 'default' }}>{inner}</div>;
}

export async function askNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export default function Settings() {
  const { t, prefs, update } = usePrefs();
  const { user, logout } = useAuth();
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const r = prefs.reminder;
  const setR = (patch) => update((p) => ({ reminder: { ...p.reminder, ...patch } }));

  return (
    <main className="page narrow">
      <TopBar title={t('settings')} />
      <section className="card row">
        <span className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)', fontWeight: 700 }}>{(user?.fullName || '?')[0]}</span>
        <div className="tx-main"><p style={{ fontWeight: 700 }}>{user?.fullName}</p><p className="tiny muted num" style={{ textAlign: 'start' }}>@{user?.username}</p></div>
      </section>

      <section className="card list">
        <Row icon={Languages} label={t('language')}>
          <div className="seg" style={{ width: 150 }}>
            <button type="button" className={prefs.lang === 'ar' ? 'on' : ''} onClick={() => update({ lang: 'ar' })}>عربي</button>
            <button type="button" className={prefs.lang === 'en' ? 'on' : ''} onClick={() => update({ lang: 'en' })}>English</button>
          </div>
        </Row>
        <div className="tx" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
          <div className="row"><span className="tx-icon"><Moon size={19} color="var(--primary-text)" /></span><span className="small" style={{ fontWeight: 600 }}>{t('theme')}</span></div>
          <div className="seg">
            {['system', 'light', 'dark'].map((k) => (
              <button key={k} type="button" className={prefs.theme === k ? 'on' : ''} onClick={() => update({ theme: k })}>
                {t(k === 'system' ? 'themeSystem' : k === 'light' ? 'themeLight' : 'themeDark')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h2>{t('reminders')}</h2>
      <section className="card list">
        {perm !== 'granted' && (
          <div className="tx" style={{ cursor: 'default' }}>
            <span className="tx-icon"><Bell size={19} color="var(--copper)" /></span>
            <span className="tx-main small">{perm === 'denied' ? t('notifDenied') : t('enableNotif')}</span>
            {perm !== 'denied' && perm !== 'unsupported' && <button type="button" className="btn sm primary" onClick={async () => setPerm(await askNotifications())}>{t('enableNotif')}</button>}
          </div>
        )}
        <Toggle label={t('dailyReminder')} on={r.daily} set={(v) => setR({ daily: v })}>
          <input type="time" className="input" style={{ width: 128, height: 40 }} value={r.time} onChange={(e) => setR({ time: e.target.value })} disabled={!r.daily} aria-label="time" />
        </Toggle>
        <Toggle label={t('weeklySummary')} on={r.weekly} set={(v) => setR({ weekly: v })} />
        <Toggle label={t('budgetAlerts')} on={r.budget} set={(v) => setR({ budget: v })} />
        <Toggle label={t('goalNudges')} on={r.goals} set={(v) => setR({ goals: v })} />
        <div className="tx" style={{ cursor: 'default' }}>
          <span className="tx-main small" style={{ fontWeight: 600 }}>{t('quietHours')}</span>
          <span className="tiny muted">{t('from')}</span>
          <input type="time" className="input" style={{ width: 116, height: 40, paddingInline: 8 }} value={r.quietFrom} onChange={(e) => setR({ quietFrom: e.target.value })} aria-label="quiet from" />
          <span className="tiny muted">{t('to')}</span>
          <input type="time" className="input" style={{ width: 116, height: 40, paddingInline: 8 }} value={r.quietTo} onChange={(e) => setR({ quietTo: e.target.value })} aria-label="quiet to" />
        </div>
      </section>

      <section className="card list">
        <Row icon={Wallet} label={t('budget')} to="/budget" />
        <Row icon={BarChart3} label={t('insights')} to="/expenses?tab=insights" />
        <Row icon={Target} label={t('goals')} to="/goals" />
        <Row icon={PiggyBank} label={t('zakat')} to="/zakat" />
        <Row icon={Receipt} label={t('myAccounts')} to="/accounts" />
      </section>

      <section className="card list">
        <Row icon={UserRound} label={t('account')} to="/profile" />
        <Row icon={KeyRound} label={prefs.lang === 'ar' ? 'تغيير الباسورد' : 'Change password'} to="/change-password" />
        <button type="button" className="tx" onClick={logout}>
          <span className="tx-icon"><LogOut size={19} color="var(--danger)" /></span>
          <span className="tx-main small bad" style={{ fontWeight: 600 }}>{t('logout')}</span>
        </button>
      </section>
    </main>
  );
}

function Toggle({ label, on, set, children }) {
  return (
    <div className="tx" style={{ cursor: 'default' }}>
      <span className="tx-main small" style={{ fontWeight: 600 }}>{label}</span>
      {children}
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => set(!on)} />
    </div>
  );
}

/** First-run wizard: budget, then reminders. */
export function Setup() {
  const { t, update } = usePrefs();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState('');
  const [time, setTime] = useState('21:00');
  const [busy, setBusy] = useState(false);

  const finish = () => { update((p) => ({ setupDone: true, reminder: { ...p.reminder, time } })); navigate('/', { replace: true }); };
  const saveBudget = async () => {
    if (Number(budget) > 0) {
      setBusy(true);
      try { await put('/api/coach/budget', { month: monthKey(), amount: budget }); } catch { /* can set later */ }
      setBusy(false);
    }
    setStep(1);
  };

  return (
    <div className="auth">
      <div className="between">
        <div className="dots">{[0, 1].map((i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <button type="button" className="link-btn" onClick={() => (step === 0 ? setStep(1) : finish())}>{t('skip')}</button>
      </div>
      {step === 0 ? (
        <div className="stack-lg">
          <img src="/ershak-coin2.png" alt="" className="coin" style={{ width: 64, height: 64 }} />
          <h1>{t('monthlyBudget')}</h1>
          <p className="small muted">{t('setBudgetHint')}</p>
          <input className="input amount" inputMode="decimal" placeholder="0" value={budget} autoFocus
            onChange={(e) => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^\d{0,9}$/.test(v)) setBudget(v); }} />
          <div className="chips">{[5000, 9000, 15000].map((n) => <button key={n} type="button" className="chip num" onClick={() => setBudget(String(n))}>{money(n)}</button>)}</div>
          <button type="button" className="btn primary block" disabled={busy} onClick={saveBudget}>{t('next')}</button>
        </div>
      ) : (
        <div className="stack-lg">
          <span className="tx-icon" style={{ width: 64, height: 64, borderRadius: 22 }}><Bell size={30} color="var(--copper)" /></span>
          <h1>{t('dailyReminder')}</h1>
          <p className="small muted">هبعتلك تذكير واحد في اليوم علشان متنساش تسجّل. لو سجّلت قبلها مش هزعجك.</p>
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          <button type="button" className="btn primary block" onClick={async () => { await askNotifications(); finish(); }}>{t('letsGo')}</button>
        </div>
      )}
    </div>
  );
}
