import { useEffect, useState } from 'react';
import { get, put } from '../../api';
import { useToast } from '../../components/Toast';
import { ErrorCard, Skeleton, useLoader } from '../../components/ui';
import { useL } from '../../prefs';
import { localize } from '../../serverText';

// [key, English, Arabic]
const GROUPS = [
  { title: ['Decisions', 'القرارات'], keys: [['otp_threshold', 'Ask for OTP from score', 'اطلب OTP من درجة'], ['hold_threshold', 'Hold for review from score', 'وقّف للمراجعة من درجة']] },
  { title: ['R1 · Unusual amount', 'R1 · مبلغ غير معتاد'], keys: [['r1_multiplier', 'Times the 30-day average', 'مرات متوسط 30 يوم'], ['r1_min_history', 'Past transfers needed', 'تحويلات سابقة مطلوبة'], ['r1_points', 'Points', 'النقط']] },
  { title: ['R2 · Rapid fire', 'R2 · عمليات ورا بعض'], keys: [['r2_count', 'Transactions', 'عدد العمليات'], ['r2_window_minutes', 'Within minutes', 'خلال دقايق'], ['r2_points', 'Points', 'النقط']] },
  { title: ['R3 · New recipient', 'R3 · مستلم جديد'], keys: [['r3_amount', 'From amount (EGP)', 'من مبلغ (جنيه)'], ['r3_points', 'Points', 'النقط']] },
  { title: ['R4 · Late night', 'R4 · بالليل متأخر'], keys: [['r4_start_hour', 'From hour', 'من الساعة'], ['r4_end_hour', 'To hour', 'لحد الساعة'], ['r4_amount', 'From amount (EGP)', 'من مبلغ (جنيه)'], ['r4_points', 'Points', 'النقط']] },
  { title: ['R5 · Drains the account', 'R5 · بيفضّي الحساب'], keys: [['r5_ratio', 'Share of balance (0-1)', 'نسبة من الرصيد (0-1)'], ['r5_points', 'Points', 'النقط']] },
  { title: ['R6 · Near the daily limit', 'R6 · قريب من الحد اليومي'], keys: [['r6_ratio', 'Share of remaining limit (0-1)', 'نسبة من الحد الباقي (0-1)'], ['r6_points', 'Points', 'النقط']] },
  { title: ['Limits and fees', 'الحدود والرسوم'], keys: [['daily_transfer_limit', 'Daily transfer limit', 'حد التحويل اليومي'], ['daily_withdraw_limit', 'Daily withdrawal limit', 'حد السحب اليومي'], ['transfer_fee', 'Transfer fee', 'رسوم التحويل'], ['overdraft_limit', 'Current overdraft', 'السحب على المكشوف (جاري)'], ['savings_monthly_outgoing', 'Savings outgoing per month', 'عمليات خروج التوفير في الشهر']] },
  { title: ['Login security', 'أمان الدخول'], keys: [['max_failed_logins', 'Wrong passwords before lock', 'باسورد غلط قبل القفل'], ['lock_minutes', 'Lock minutes', 'دقايق القفل'], ['session_timeout_minutes', 'Session timeout minutes', 'دقايق انتهاء الجلسة']] },
];

/** Fraud Guard tuning. Every change is written to the audit log. */
export default function Rules() {
  const L = useL();
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
      toast(L('Saved. The next transaction uses the new rules.', 'اتحفظ. العملية الجاية هتمشي بالقواعد الجديدة.'));
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
        <h1>{L('Fraud rules', 'قواعد الاحتيال')}</h1>
        <p className="small muted" style={{ marginTop: 4 }}>{L('Each rule adds points. The total decides: allow, ask for a code, or hold for review.', 'كل قاعدة بتزوّد نقط، والمجموع بيقرر: يعدّي، أو يطلب كود، أو يتوقف للمراجعة.')}</p>
      </div>
      {loading && <Skeleton height={300} />}
      {error && <ErrorCard error={error} onRetry={reload} />}
      {data && (
        <form onSubmit={save} className="stack-lg">
          <section className="card table-wrap">
            <table className="data">
              <thead><tr><th>{L('Rule', 'القاعدة')}</th><th>{L('What it checks', 'بتراجع إيه')}</th></tr></thead>
              <tbody>{data.rules.map((r) => <tr key={r.id}><td><span className="badge accent">{r.id}</span></td><td>{localize(r.description)}</td></tr>)}</tbody>
            </table>
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {GROUPS.map((g) => (
              <fieldset key={g.title[0]} className="card stack" style={{ margin: 0 }}>
                <legend className="sr-only">{L(g.title[0], g.title[1])}</legend>
                <h3>{L(g.title[0], g.title[1])}</h3>
                {g.keys.map(([k, label, labelAr]) => (
                  <div key={k} className="between">
                    <label htmlFor={k} className="small muted">{L(label, labelAr)}</label>
                    <input id={k} className="input num" style={{ width: 110, height: 38, textAlign: 'end', direction: 'ltr' }} inputMode="decimal"
                      value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy || Object.keys(changed).length === 0}>
              {busy ? L('Saving…', 'بيحفظ…') : Object.keys(changed).length ? L(`Save ${Object.keys(changed).length} change${Object.keys(changed).length > 1 ? 's' : ''}`, `احفظ ${Object.keys(changed).length} تعديل`) : L('No changes', 'مفيش تعديلات')}
            </button>
            {Object.keys(changed).length > 0 && <button type="button" className="btn ghost" onClick={() => setValues(data.settings)}>{L('Undo', 'تراجع')}</button>}
          </div>
        </form>
      )}
    </>
  );
}
