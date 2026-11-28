import { Link, useNavigate } from 'react-router-dom';
import { get } from '../api';
import Icon from '../components/Icon';
import { Empty, ErrorCard, Proverb, Skeleton, TopBar, TxRow, useLoader } from '../components/ui';
import { useL, usePrefs } from '../prefs';
import { amount, typeLabel } from '../format';

export default function Accounts() {
  const { t } = usePrefs();
  const L = useL();
  const navigate = useNavigate();
  const accounts = useLoader(() => get('/api/accounts'));
  const recent = useLoader(() => get('/api/transactions/recent?limit=6'));

  return (
    <main className="page">
      <TopBar title={t('myAccounts')} right={<span className="badge ok">Fraud Guard</span>} />

      {accounts.loading && <Skeleton height={190} />}
      {accounts.error && <ErrorCard error={accounts.error} onRetry={accounts.reload} />}
      {accounts.data && accounts.data.length === 0 && (
        <Empty title={L('Open your first account', 'افتح أول حساب')} action={<Link className="btn primary" to="/profile?open=1">{L('Open account', 'افتح حساب')}</Link>}>
          <Proverb>القرش الأبيض ينفع في اليوم الأسود</Proverb>
          <p className="small muted">{L('Choose Savings for your goals or Current for everyday spending.', 'اختار توفير لأهدافك أو جاري للمصروف اليومي.')}</p>
        </Empty>
      )}
      {accounts.data && accounts.data.length > 0 && (
        <div className="balance-cards">
          {accounts.data.map((a) => (
            <section key={a.id} className={`card balance stack${a.type === 'CURRENT' ? ' navy' : ''}`} aria-label={typeLabel[a.type]} style={{ gap: 14 }}>
              <div className="between">
                <p className="small muted">{typeLabel[a.type]}</p>
                <div className="row" style={{ gap: 8 }}>
                  {a.status === 'FROZEN' && <span className="badge bad">{L('Frozen', 'مجمّد')}</span>}
                  <p className="small muted num">{a.maskedNumber}</p>
                </div>
              </div>
              <div>
                <p className="tiny muted">{L('Available balance', 'الرصيد المتاح')}</p>
                <p className="row" style={{ alignItems: 'baseline', gap: 8, direction: 'ltr', justifyContent: 'flex-end' }}>
                  <span className="muted" style={{ fontWeight: 500 }}>EGP</span>
                  <span className="amount">{amount(a.availableBalance)}</span>
                </p>
                {Number(a.holdAmount) > 0 && <p className="tiny warn">{L(`EGP ${amount(a.holdAmount)} held for review`, `${amount(a.holdAmount)} جنيه محجوزين للمراجعة`)}</p>}
                {a.type === 'CURRENT' && Number(a.balance) < 0 && <p className="tiny warn">{L(`Using overdraft: EGP ${amount(-a.balance)}`, `سحب على المكشوف: ${amount(-a.balance)} جنيه`)}</p>}
              </div>
              <div className="row" style={{ borderTop: '1px solid color-mix(in srgb, currentColor 18%, transparent)', paddingTop: 12, gap: 10 }}>
                <Icon name="shieldCheck" size={18} color="var(--good)" />
                <p className="small">{L('Fraud Guard is on', 'Fraud Guard شغال')}</p>
                <p className="tiny muted swipe-hint" style={{ marginInlineStart: 'auto' }}>{accounts.data.length > 1 ? L('Swipe for more', 'اسحب للباقي') : L('Checks every transfer', 'بيراجع كل تحويل')}</p>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="grid-4">
        <button type="button" className="action primary" onClick={() => navigate('/transfer')}><Icon name="transfer" size={22} />{L('Transfer', 'تحويل')}</button>
        <button type="button" className="action" onClick={() => navigate('/move/deposit')}><Icon name="plus" size={22} />{L('Deposit', 'إيداع')}</button>
        <button type="button" className="action" onClick={() => navigate('/move/withdraw')}><Icon name="cash" size={22} />{L('Withdraw', 'سحب')}</button>
        <button type="button" className="action" onClick={() => navigate('/activity')}><Icon name="list" size={22} />{L('Statement', 'كشف حساب')}</button>
      </div>

      <div className="between">
        <h2>{L('Recent activity', 'آخر العمليات')}</h2>
        <Link to="/activity" className="small">{L('See all', 'الكل')}</Link>
      </div>
      {recent.loading && <Skeleton height={200} />}
      {recent.data && recent.data.length === 0 && <p className="small muted">{L('No transactions yet.', 'مفيش عمليات لسه.')}</p>}
      {recent.data && recent.data.length > 0 && (
        <div className="card list">
          {recent.data.map((tx) => <TxRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </main>
  );
}
