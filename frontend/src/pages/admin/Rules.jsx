import { useEffect, useState } from 'react';
import { get, put } from '../../api';
import { useToast } from '../../components/Toast';
import { ErrorCard, Skeleton, useLoader } from '../../components/ui';

const GROUPS = [
  { title: 'Decisions', keys: [['otp_threshold', 'Ask for OTP from score'], ['hold_threshold', 'Hold for review from score']] },
  { title: 'R1 · Unusual amount', keys: [['r1_multiplier', 'Times the 30-day average'], ['r1_min_history', 'Past transfers needed'], ['r1_points', 'Points']] },
  { title: 'R2 · Rapid fire', keys: [['r2_count', 'Transactions'], ['r2_window_minutes', 'Within minutes'], ['r2_points', 'Points']] },
  { title: 'R3 · New recipient', keys: [['r3_amount', 'From amount (EGP)'], ['r3_points', 'Points']] },
  { title: 'R4 · Late night', keys: [['r4_start_hour', 'From hour'], ['r4_end_hour', 'To hour'], ['r4_amount', 'From amount (EGP)'], ['r4_points', 'Points']] },
  { title: 'R5 · Drains the account', keys: [['r5_ratio', 'Share of balance (0-1)'], ['r5_points', 'Points']] },
  { title: 'R6 · Near the daily limit', keys: [['r6_ratio', 'Share of remaining limit (0-1)'], ['r6_points', 'Points']] },
  { title: 'Limits and fees', keys: [['daily_transfer_limit', 'Daily transfer limit'], ['daily_withdraw_limit', 'Daily withdrawal limit'], ['transfer_fee', 'Transfer fee'], ['overdraft_limit', 'Current overdraft'], ['savings_monthly_outgoing', 'Savings outgoing per month']] },
  { title: 'Login security', keys: [['max_failed_logins', 'Wrong passwords before lock'], ['lock_minutes', 'Lock minutes'], ['session_timeout_minutes', 'Session timeout minutes']] },
];

/** Fraud Guard tuning. Every change is written to the audit log. */
export default function Rules() {
  const { data, error, loading, reload } = useLoader(() => get('/api/admin/rules'));
  const toast = useToast();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data.settings);
  }, [data]);

  const changed = data ? Object.fromEntries(Object.entries(values).filter(([k, v]) => String(v) !== String(data.settings[k]))) : {};

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await put('/api/admin/settings', changed);
      toast('Saved. The next transaction uses the new rules.');
      reload();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <h1>Fraud rules</h1>
        <p className="small muted" style={{ marginTop: 4 }}>Each rule adds points. The total decides: allow, ask for a code, or hold for review.</p>
      </div>
      {loading && <Skeleton height={300} />}
      {error && <ErrorCard error={error} onRetry={reload} />}
      {data && (
        <form onSubmit={save} className="stack-lg">
          <section className="card table-wrap">
            <table className="data">
              <thead><tr><th>Rule</th><th>What it checks</th></tr></thead>
              <tbody>{data.rules.map((r) => <tr key={r.id}><td><span className="badge accent">{r.id}</span></td><td>{r.description}</td></tr>)}</tbody>
            </table>
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="card stack" style={{ margin: 0 }}>
                <legend className="sr-only">{g.title}</legend>
                <h3>{g.title}</h3>
                {g.keys.map(([k, label]) => (
                  <div key={k} className="between">
                    <label htmlFor={k} className="small muted">{label}</label>
                    <input id={k} className="input num" style={{ width: 110, height: 38, textAlign: 'right' }} inputMode="decimal"
                      value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy || Object.keys(changed).length === 0}>
              {busy ? 'Saving…' : Object.keys(changed).length ? `Save ${Object.keys(changed).length} change${Object.keys(changed).length > 1 ? 's' : ''}` : 'No changes'}
            </button>
            {Object.keys(changed).length > 0 && <button type="button" className="btn ghost" onClick={() => setValues(data.settings)}>Undo</button>}
          </div>
        </form>
      )}
    </>
  );
}
