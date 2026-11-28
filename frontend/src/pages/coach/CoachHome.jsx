import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SmsSheet from '../../components/SmsSheet';
import { isNative, newBankSms, smsPermissionGranted } from '../../native';
import { Bell, ChevronLeft, ChevronRight, Landmark, MessageSquareText, Plus, ShieldCheck, Target } from 'lucide-react';
import { get } from '../../api';
import { useAuth } from '../../auth';
import { CatIcon, money, useCatName, useQuickAdd } from '../../coach';
import { ErrorCard, Skeleton, useLoader } from '../../components/ui';
import { usePrefs } from '../../prefs';
import { firstName } from '../../format';

export default function CoachHome() {
  const { user, unread } = useAuth();
  const { t, ar } = usePrefs();
  const { show, version } = useQuickAdd();
  const navigate = useNavigate();
  const catName = useCatName();
  const ov = useLoader(() => get('/api/coach/overview'), [version]);
  const today = useLoader(() => get('/api/coach/expenses'), [version]);
  const accounts = useLoader(() => get('/api/accounts'));
  const goals = useLoader(() => get('/api/goals'));
  const Chev = ar ? ChevronLeft : ChevronRight;
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsCount, setSmsCount] = useState(null);

  // Android app: quietly count new bank messages (only if SMS permission was already given).
  useEffect(() => {
    if (!isNative()) return;
    smsPermissionGranted().then((ok) => ok && newBankSms().then((m) => setSmsCount(m.length)).catch(() => {}));
  }, [version]);

  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Africa/Cairo' }));
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const todays = (today.data || []).filter((e) => new Date(e.spentAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }) === todayKey);
  const todaySum = todays.reduce((s, e) => s + Number(e.amount), 0);
  const o = ov.data;
  const hasBudget = o && Number(o.budget) > 0;
  const nextGoal = (goals.data || []).filter((g) => g.status !== 'ACHIEVED').sort((a, b) => b.progress - a.progress)[0];
  const totalBalance = (accounts.data || []).reduce((s, a) => s + Number(a.availableBalance), 0);

  return (
    <main className="page">
      <div className="between">
        <div>
          <p className="small muted">{h < 12 ? t('greetMorning') : t('greetEvening')}</p>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{firstName(user?.fullName)}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="icon-btn" aria-label={`${t('notifications')}${unread ? ` (${unread})` : ''}`} onClick={() => navigate('/notifications')}>
            <Bell size={20} />{unread > 0 && <span className="dot" />}
          </button>
          <button type="button" className="icon-btn" aria-label={t('settings')} onClick={() => navigate('/settings')}
            style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, borderColor: 'var(--primary)' }}>
            {(user?.fullName || '?').trim()[0]}
          </button>
        </div>
      </div>

      <div className="desk-2">
        <div className="stack-lg">
          {ov.loading && !o && <Skeleton height={170} />}
          {ov.error && <ErrorCard error={ov.error} onRetry={ov.reload} />}
          {o && (hasBudget ? (
            <section className="card navy stack" style={{ gap: 12 }} aria-label={t('leftThisMonth')}>
              <p className="small muted">{t('leftThisMonth')}</p>
              <p className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                <span className="big-amount num">{money(o.left)}</span>
                <span className="small muted">{t('of')} <span className="num">{money(o.budget)}</span></span>
              </p>
              <div className={`progress ${o.mood}`} role="progressbar" aria-valuenow={Number(o.leftPercent)} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${Math.max(0, Math.min(100, Number(o.leftPercent)))}%` }} />
              </div>
              <div className="between tiny muted">
                <span><span className="num">{o.daysLeft}</span> {t('daysLeft')}</span>
                <span className="num">{Math.round(Number(o.leftPercent))}%</span>
              </div>
            </section>
          ) : (
            <section className="card stack">
              <h2>{t('setBudget')}</h2>
              <p className="small muted">{t('setBudgetHint')}</p>
              <button type="button" className="btn primary" onClick={() => navigate('/budget')}>{t('setBudget')}</button>
            </section>
          ))}

          {o && (
            <button type="button" className="coach" style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer' }} onClick={() => navigate('/chat')}>
              <img src="/ershak-coin2.png" alt="" className="coin" />
              <div className="bubble stack" style={{ gap: 4 }}>
                <span className={`mood ${o.mood}`}>{t('ershak')} · {o.moodLabel}</span>
                <span dir="rtl">{o.message}</span>
              </div>
            </button>
          )}

          {isNative() && (
            <section className="card tight between">
              <div className="row">
                <span className="tx-icon"><MessageSquareText size={19} color="var(--copper)" /></span>
                <p className="small">{smsCount ? (ar ? `لقيت ${smsCount} رسايل بنك جديدة` : `${smsCount} new bank messages`) : (ar ? 'سجّل من رسايل البنك' : 'Log from bank SMS')}</p>
              </div>
              <button type="button" className="btn sm" onClick={() => setSmsOpen(true)}>{ar ? 'افتح' : 'Open'}</button>
            </section>
          )}
          {smsOpen && <SmsSheet onClose={() => setSmsOpen(false)} />}

          <section className="card tight between">
            <p className="small">{todays.length ? t('todaySome', todays.length, money(todaySum)) : t('todayNone')}</p>
            <button type="button" className="btn sm primary" onClick={() => show()}><Plus size={16} />{t('logNow')}</button>
          </section>
        </div>

        <div className="stack-lg">
          {o && o.categories?.length > 0 && (
            <section className="stack">
              <div className="section-title"><h2>{t('topSpending')}</h2><Link to="/expenses?tab=insights">{t('all')}</Link></div>
              <div className="card list">
                {o.categories.slice(0, 4).map((c) => (
                  <Link key={c.category.id} to={`/expenses?cat=${c.category.id}`} className="tx">
                    <CatIcon category={c.category} />
                    <div className="tx-main">
                      <p className="tx-title">{catName(c.category)}</p>
                      <p className={`tiny ${c.category.essential ? 'good' : 'bad'}`}>{c.category.essential ? t('essential') : t('nonEssential')} · <span className="num">{Math.round(Number(c.percent))}%</span></p>
                    </div>
                    <p className="tx-amount">{money(c.total)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {o && !o.categories?.length && (
            <section className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <img src="/ershak-coin2.png" alt="" className="coin" style={{ width: 56, height: 56 }} />
              <h2>{t('welcomeTitle')}</h2>
              <p className="small muted">{t('welcomeBody')}</p>
              <button type="button" className="btn primary" onClick={() => show()}>{t('firstExpense')}</button>
            </section>
          )}

          <Link to="/accounts" className="card tight between" style={{ color: 'var(--text)' }}>
            <div className="row">
              <span className="tx-icon"><Landmark size={20} color="var(--primary-text)" /></span>
              <div>
                <p className="small" style={{ fontWeight: 700 }}>{t('myAccounts')}</p>
                <p className="tiny muted row" style={{ gap: 4 }}><ShieldCheck size={13} color="var(--good)" /> Fraud Guard</p>
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {accounts.data && <span className="num" style={{ fontWeight: 700 }}>{money(totalBalance)}</span>}
              <Chev size={18} color="var(--muted)" />
            </div>
          </Link>

          <Link to="/goals" className="card tight stack" style={{ color: 'var(--text)', gap: 8 }}>
            <div className="between">
              <div className="row">
                <span className="tx-icon"><Target size={20} color="var(--copper)" /></span>
                <div>
                  <p className="tiny muted">{t('nearestGoal')}</p>
                  <p className="small" style={{ fontWeight: 700 }}>{nextGoal ? nextGoal.name : t('noGoal')}</p>
                </div>
              </div>
              {nextGoal && <span className="num copper" style={{ fontWeight: 700 }}>{nextGoal.progress}%</span>}
            </div>
            {nextGoal && <div className="progress"><div style={{ width: `${nextGoal.progress}%` }} /></div>}
          </Link>
        </div>
      </div>
    </main>
  );
}
