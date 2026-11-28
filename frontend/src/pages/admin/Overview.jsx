import { Link } from 'react-router-dom';
import { get } from '../../api';
import Icon from '../../components/Icon';
import { ErrorCard, Proverb, Skeleton, useLoader } from '../../components/ui';
import { compact, time } from '../../format';
import ReviewTable from './ReviewTable';
import { useL } from '../../prefs';

export default function Overview() {
  const L = useL();
  const { data, error, loading, reload } = useLoader(() => get('/api/admin/overview'));
  const today = new Date().toLocaleDateString(L('en-US', 'ar-EG-u-nu-latn'), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' });

  return (
    <>
      <div className="between" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <p className="small muted">{today}</p>
          <h1 style={{ marginTop: 4 }}>{L('Overview', 'نظرة عامة')}</h1>
        </div>
      </div>

      {loading && <Skeleton height={110} />}
      {error && <ErrorCard error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="kpis">
            <Kpi label={L('Customers', 'العملاء')} value={data.customers.toLocaleString()} />
            <Kpi label={L('Total deposits', 'إجمالي الإيداعات')} value={compact(data.totalDeposits)} />
            <Kpi label={L('Transactions today', 'عمليات النهارده')} value={data.transactionsToday} />
            <Kpi label={L('Waiting for review', 'مستنية مراجعة')} value={data.pendingReviews} danger={data.pendingReviews > 0} />
          </div>

          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <section className="card stack" style={{ flex: '999 1 520px', minWidth: 0 }}>
              <div className="between">
                <div>
                  <h2>{L('Review queue', 'قايمة المراجعة')}</h2>
                  <Proverb style={{ fontSize: 15, color: 'var(--muted)' }}>الباب اللي يجيلك منه الريح، سدّه واستريح</Proverb>
                </div>
                <Link to="/admin/reviews" className="small">{L('View all', 'الكل')}</Link>
              </div>
              <ReviewTable items={data.reviews.slice(0, 5)} onChange={reload} />
            </section>

            <section className="card stack" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <h2>{L('Audit log', 'سجل المراجعة')}</h2>
              <div className="inset row">
                <Icon name={data.audit.intact ? 'shieldCheck' : 'shieldX'} size={22} color={data.audit.intact ? 'var(--ok)' : 'var(--bad)'} />
                <div>
                  <p className={data.audit.intact ? 'ok' : 'bad'} style={{ fontWeight: 600 }}>{data.audit.intact ? L('Chain intact', 'السلسلة سليمة') : L('Tampering detected', 'فيه تلاعب')}</p>
                  <p className="tiny muted">{data.audit.totalEntries.toLocaleString()} {L('entries', 'سجل')}{data.audit.intact ? '' : ` · ${L('first broken', 'أول سجل مكسور')} #${data.audit.firstBrokenId}`}</p>
                </div>
              </div>
              <div className="stack small" style={{ gap: 10 }}>
                {data.recentAudit.map((e) => (
                  <div key={e.id} className="between" style={{ alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{e.action.replaceAll('_', ' ').toLowerCase()}</b> <span className="muted">· {e.actor}</span></span>
                    <span className="muted tiny" style={{ whiteSpace: 'nowrap' }}>{time(e.timestamp)}</span>
                  </div>
                ))}
              </div>
              <Link to="/admin/audit" className="btn sm">{L('Open audit log', 'افتح سجل المراجعة')}</Link>
            </section>
          </div>
          <p className="tiny muted">{L(`${data.flaggedToday} transactions scored by the Fraud Guard today.`, `Fraud Guard قيّم ${data.flaggedToday} عملية النهارده.`)}</p>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, danger }) {
  return (
    <div className="kpi" style={{ borderColor: danger ? 'var(--bad)' : undefined }}>
      <p className={`small ${danger ? 'bad' : 'muted'}`}>{label}</p>
      <p className="value">{value}</p>
    </div>
  );
}
