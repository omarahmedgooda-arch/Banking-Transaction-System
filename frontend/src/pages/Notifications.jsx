import { useEffect } from 'react';
import { get, post } from '../api';
import { useAuth } from '../auth';
import Icon from '../components/Icon';
import { ErrorCard, Proverb, Skeleton, TopBar, useLoader } from '../components/ui';
import { dateTime } from '../format';
import { useL } from '../prefs';
import { localize } from '../serverText';

const icons = {
  LOCK: ['lock', 'var(--bad)'],
  HOLD: ['shieldAlert', 'var(--bad)'],
  REVIEW: ['shieldCheck', 'var(--accent)'],
  COACH: ['coin', 'var(--copper)'],
  GOAL: ['goal', 'var(--ok)'],
  INTEREST: ['coin', 'var(--ok)'],
  WELCOME: ['home', 'var(--accent)'],
  RECEIVED: ['coin', 'var(--ok)'],
};

const isArabic = (s) => /[؀-ۿ]/.test(s) && !/[a-zA-Z]/.test(s);

/** "5od balak": everything that happened to your money and account. */
export default function Notifications() {
  const L = useL();
  const { setUnread } = useAuth();
  const { data, error, loading, reload } = useLoader(() => get('/api/notifications'));

  useEffect(() => {
    post('/api/notifications/read-all').then(() => setUnread(0)).catch(() => {});
  }, [setUnread]);

  return (
    <main className="page narrow">
      <TopBar title={L('Notifications', 'الإشعارات')} />
      {loading && <Skeleton height={240} />}
      {error && <ErrorCard error={error} onRetry={reload} />}
      {data?.length === 0 && <p className="small muted" style={{ textAlign: 'center', padding: 32 }}>{L("You're all caught up.", 'مفيش جديد.')}</p>}
      {data?.length > 0 && (
        <div className="card list">
          {data.map((n) => {
            const [icon, color] = icons[n.kind] || ['bell', 'var(--muted)'];
            return (
              <div key={n.id} className="tx" style={{ alignItems: 'flex-start' }}>
                <div className="tx-icon"><Icon name={icon} size={18} color={color} /></div>
                <div className="tx-main stack" style={{ gap: 2 }}>
                  <div className="between">
                    {isArabic(n.title)
                      ? <p dir="rtl" style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</p>
                      : <p dir="auto" style={{ fontWeight: 600, fontSize: 14 }}>{localize(n.title)}</p>}
                    {!n.read && <span className="badge accent">{L('New', 'جديد')}</span>}
                  </div>
                  <p className="small" dir="auto" style={{ color: 'var(--text)' }}>{localize(n.message)}</p>
                  <p className="tiny muted">{dateTime(n.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
