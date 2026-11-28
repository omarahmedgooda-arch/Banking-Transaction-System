import { useState } from 'react';
import { get, post } from '../../api';
import Icon from '../../components/Icon';
import { ErrorCard, Proverb, Skeleton, useLoader } from '../../components/ui';
import { dateTime } from '../../format';
import { useL } from '../../prefs';
import { localize } from '../../serverText';

/** The tamper-evident log. Every row carries the hash of the row before it. */
export default function AuditLog() {
  const L = useL();
  const { data, error, loading, reload } = useLoader(() => get('/api/admin/audit?limit=200'));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      setResult(await post('/api/admin/audit/verify'));
      reload();
    } catch (err) {
      setResult({ intact: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="between" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1>{L('Audit log', 'سجل المراجعة')}</h1>
          <p className="small muted" style={{ marginTop: 4 }}>{L('Each entry stores SHA-256(previous hash + this entry). Change one row and the chain breaks.', 'كل سجل بيخزّن SHA-256 للسجل اللي قبله. لو حد غيّر سطر واحد، السلسلة بتتكسر.')}</p>
        </div>
        <button type="button" className="btn primary sm" onClick={verify} disabled={busy}>
          <Icon name="shieldCheck" size={16} /> {busy ? L('Checking…', 'بيتأكد…') : L('Verify integrity', 'اتأكد من السلامة')}
        </button>
      </div>

      {result && (
        <div role="alert" className={`alert ${result.intact ? 'ok' : 'bad'}`}>
          <Icon name={result.intact ? 'shieldCheck' : 'shieldX'} size={22} color={result.intact ? 'var(--ok)' : 'var(--bad)'} />
          <div className="stack" style={{ gap: 2 }}>
            <p style={{ fontWeight: 600 }} className={result.intact ? 'ok' : 'bad'}>{result.intact ? L('Chain intact', 'السلسلة سليمة') : L('Tampering detected', 'فيه تلاعب')}</p>
            <p className="small">{localize(result.message)}</p>
            {!result.intact && <Proverb>المكتوب مكتوب</Proverb>}
          </div>
        </div>
      )}

      {loading && <Skeleton height={300} />}
      {error && <ErrorCard error={error} onRetry={reload} />}
      {data && (
        <section className="card table-wrap">
          <table className="data">
            <thead><tr><th>#</th><th>{L('Time', 'الوقت')}</th><th>{L('Actor', 'مين')}</th><th>{L('Action', 'العملية')}</th><th>{L('Details', 'التفاصيل')}</th><th>Hash</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} style={result && !result.intact && e.id === result.firstBrokenId ? { background: 'var(--bad-bg)' } : undefined}>
                  <td className="muted num">{e.id}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{dateTime(e.timestamp)}</td>
                  <td>{e.actor}</td>
                  <td><span className="badge">{e.action.replaceAll('_', ' ').toLowerCase()}</span></td>
                  <td className="muted" dir="auto" style={{ maxWidth: 320 }}>{e.details}</td>
                  <td className="mono muted" title={e.hash}>{e.hash.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
