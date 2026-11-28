import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Bell, BellRing, ChevronLeft, ChevronRight, Download, KeyRound, Languages, LogOut, Moon, PiggyBank, Receipt, Share, Target, UserRound, Wallet } from 'lucide-react';
import { canPromptInstall, enablePush, isIos, isStandalone, onInstallChange, permission, promptInstall, pushSupported, savePushPrefs, sendTestPush } from '../../push';
import { useToast } from '../../components/Toast';
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

/** Asks for notification permission and subscribes this device. */
export async function askNotifications() {
  try {
    return await enablePush();
  } catch {
    return permission();
  }
}

export default function Settings() {
  const { t, prefs, update } = usePrefs();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [perm, setPerm] = useState(permission);
  const [installable, setInstallable] = useState(canPromptInstall);
  const r = prefs.reminder;
  const setR = (patch) => update((p) => ({ reminder: { ...p.reminder, ...patch } }));
  const ar = prefs.lang === 'ar';
  const first = useRef(true);

  useEffect(() => onInstallChange(setInstallable), []);
  // Save reminder settings on the server (it sends the reminders), a moment after the last change.
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const id = setTimeout(() => savePushPrefs(r).catch((e) => toast(e.message, 'bad')), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const test = async () => {
    try {
      const { sent } = await sendTestPush();
      toast(sent ? (ar ? 'بعتنا إشعار تجربة' : 'Test notification sent') : (ar ? 'مفيش جهاز مفعّل عليه الإشعارات' : 'No device has notifications on'), sent ? 'ok' : 'bad');
    } catch (e) { toast(e.message, 'bad'); }
  };

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

      {!isStandalone() && (installable || isIos()) && (
        <section className="card row">
          <span className="tx-icon"><Download size={19} color="var(--copper)" /></span>
          <div className="tx-main">
            <p className="small" style={{ fontWeight: 700 }}>{ar ? 'سطّب قرشك على موبايلك' : 'Install Ershak'}</p>
            <p className="tiny muted">
              {installable ? (ar ? 'يفتح زي أي تطبيق، من غير المتصفح.' : 'Opens like an app, without the browser.')
                : (ar ? 'في Safari دوس زرار المشاركة، وبعدين «أضف إلى الشاشة الرئيسية».' : 'In Safari tap Share, then “Add to Home Screen”.')}
            </p>
          </div>
          {installable ? <button type="button" className="btn sm primary" onClick={promptInstall}>{ar ? 'سطّب' : 'Install'}</button>
            : <Share size={20} color="var(--muted)" />}
        </section>
      )}

      <h2>{t('reminders')}</h2>
      <section className="card list">
        {perm !== 'granted' && (
          <div className="tx" style={{ cursor: 'default' }}>
            <span className="tx-icon"><Bell size={19} color="var(--copper)" /></span>
            <span className="tx-main small">
              {perm === 'denied' ? t('notifDenied')
                : !pushSupported() ? (isIos() && !isStandalone() ? (ar ? 'على الآيفون: سطّب التطبيق الأول، وبعدين فعّل الإشعارات من جوه.' : 'On iPhone, install the app first, then turn on notifications inside it.') : (ar ? 'المتصفح ده مش بيدعم الإشعارات.' : 'This browser does not support notifications.'))
                  : t('enableNotif')}
            </span>
            {perm === 'default' && pushSupported() && (
              <button type="button" className="btn sm primary" onClick={async () => {
                const res = await askNotifications();
                setPerm(res);
                if (res === 'granted') savePushPrefs(r).catch(() => {});
              }}>{t('enableNotif')}</button>
            )}
          </div>
        )}
        {perm === 'granted' && (
          <div className="tx" style={{ cursor: 'default' }}>
            <span className="tx-icon"><BellRing size={19} color="var(--good)" /></span>
            <span className="tx-main small" style={{ fontWeight: 600 }}>{ar ? 'الإشعارات شغالة على الجهاز ده' : 'Notifications are on for this device'}</span>
            <button type="button" className="btn sm" onClick={test}>{ar ? 'جرّب' : 'Test'}</button>
          </div>
        )}
        <Toggle label={t('dailyReminder')} on={r.daily} set={(v) => setR({ daily: v })}>
          <input type="time" className="input" style={{ width: 128, height: 40 }} value={r.time} onChange={(e) => setR({ time: e.target.value })} disabled={!r.daily} aria-label="time" />
        </Toggle>
        <Toggle label={t('weeklySummary')} on={r.weekly} set={(v) => setR({ weekly: v })}>
          <select className="input" style={{ width: 110, height: 40, paddingInline: 8 }} value={r.weeklyDay || 'fri'} disabled={!r.weekly}
            onChange={(e) => setR({ weeklyDay: e.target.value })} aria-label="day">
            {[['sat', 'السبت', 'Sat'], ['sun', 'الحد', 'Sun'], ['mon', 'الاتنين', 'Mon'], ['tue', 'التلات', 'Tue'], ['wed', 'الأربع', 'Wed'], ['thu', 'الخميس', 'Thu'], ['fri', 'الجمعة', 'Fri']]
              .map(([v, a, e]) => <option key={v} value={v}>{ar ? a : e}</option>)}
          </select>
        </Toggle>
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
  const { t, update, prefs } = usePrefs();
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
          <button type="button" className="btn primary block" onClick={async () => {
            const res = await askNotifications();
            if (res === 'granted') savePushPrefs({ ...prefs.reminder, time }).catch(() => {});
            finish();
          }}>{t('letsGo')}</button>
        </div>
      )}
    </div>
  );
}
