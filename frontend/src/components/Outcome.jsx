import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Proverb } from './ui';
import { get, post } from '../api';
import { egp, time } from '../format';
import { useToast } from './Toast';
import { play } from '../sound';
import { useL } from '../prefs';
import { localize } from '../serverText';

/** What the customer sees after sending money: done, enter a code, or held for review. */
export default function Outcome({ result, title = 'Transfer' }) {
  const [tx, setTx] = useState(result.transaction);
  const reasons = result.risk?.reasons || [];

  if (tx.status === 'COMPLETED') return <Done tx={tx} title={title} />;
  if (tx.status === 'PENDING_OTP') return <OtpPanel tx={tx} reasons={reasons} score={result.risk?.score} onFinish={setTx} />;
  if (tx.status === 'PENDING_REVIEW') return <Held tx={tx} reasons={reasons} score={result.risk?.score} onFinish={setTx} />;
  return <Cancelled tx={tx} />;
}

export function Done({ tx, title }) {
  const L = useL();
  useEffect(() => {
    play('success');
  }, []);
  return (
    <div className="stack-lg" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
      <div className="tx-icon" style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--ok-bg)' }}>
        <Icon name="check" size={36} color="var(--ok)" stroke={2.2} />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{L(`${title} done`, `${title} تم`)}</h1>
        <p className="num" style={{ fontSize: 30, fontWeight: 700 }}>{egp(tx.amount)}</p>
        {Number(tx.fee) > 0 && <p className="small muted">{L('Fee', 'الرسوم')} {egp(tx.fee)}</p>}
      </div>
      <div className="card" style={{ width: '100%', textAlign: 'start' }}>
        <div className="between small"><span className="muted">{L('Reference', 'الرقم المرجعي')}</span><span className="num">{tx.reference}</span></div>
        <div className="between small" style={{ marginTop: 10 }}><span className="muted">{L('Time', 'الوقت')}</span><span>{time(tx.completedAt || tx.createdAt)}</span></div>
      </div>
      <Link className="btn primary block" to="/accounts">{L('Back to accounts', 'رجوع لحساباتي')}</Link>
    </div>
  );
}

function Cancelled({ tx }) {
  const L = useL();
  useEffect(() => {
    play('alert');
  }, []);
  return (
    <div className="stack-lg" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
      <div className="tx-icon" style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--bad-bg)' }}>
        <Icon name="shieldX" size={34} color="var(--bad)" />
      </div>
      <h1>{L('Transfer cancelled', 'التحويل اتلغى')}</h1>
      <Proverb lg>الحرص واجب</Proverb>
      <p className="muted small">{L('Nothing left your account. Reference', 'مفيش فلوس خرجت من حسابك. الرقم المرجعي')} {tx.reference}.</p>
      <Link className="btn primary block" to="/accounts">{L('Back to accounts', 'رجوع لحساباتي')}</Link>
    </div>
  );
}

export function Reasons({ reasons, score }) {
  const L = useL();
  if (!reasons?.length) return null;
  return (
    <div className="card stack">
      <div className="between">
        <h3>{L("Why we're checking", 'ليه بنراجع')}</h3>
        {score != null && <span className={`badge ${score >= 60 ? 'bad' : 'warn'}`}>{L('Risk', 'الخطر')} {score} / 100</span>}
      </div>
      {score != null && (
        <div className={`progress ${score >= 60 ? 'bad' : ''}`}>
          <div style={{ width: `${score}%`, background: score >= 60 ? undefined : 'var(--warn)' }} />
        </div>
      )}
      {reasons.map((r) => (
        <div key={r.ruleId} className="row" style={{ alignItems: 'baseline' }}>
          <span className="tiny num" style={{ width: 30, fontWeight: 600, color: score >= 60 ? 'var(--bad)' : 'var(--warn)' }}>+{r.points}</span>
          <p className="small">{localize(r.reason)}</p>
        </div>
      ))}
    </div>
  );
}

/** Six-box code entry, with the simulated SMS that delivered the code. */
export function OtpPanel({ tx, reasons, score, onFinish }) {
  const L = useL();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [sms, setSms] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(() => Math.max(0, 120 - Math.floor((Date.now() - tx.createdAt) / 1000)));
  const refs = useRef([]);
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(() => get('/api/sms').then((m) => { setSms(m[0] || null); if (m[0]) play('otp'); }).catch(() => {}), 700);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, []);

  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split('');
      setDigits([...next, ...Array(6 - next.length).fill('')]);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError(L('Enter all 6 digits.', 'اكتب الـ 6 أرقام.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await post(`/api/transactions/${tx.id}/otp`, { code });
      if (r.success) {
        toast(L('Confirmed. Money sent.', 'اتأكد. الفلوس اتبعتت.'));
        onFinish(r.transaction);
      } else if (r.transaction.status === 'REJECTED') {
        onFinish(r.transaction);
      } else {
        setError(localize(r.message));
        setDigits(['', '', '', '', '', '']);
        refs.current[0]?.focus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack-lg" onSubmit={submit}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div className="tx-icon" style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--warn-bg)' }}>
          <Icon name="key" size={30} color="var(--warn)" />
        </div>
        <h1>{L("Confirm it's you", 'أكّد إنه إنت')}</h1>
        <Proverb lg>الحرص واجب</Proverb>
        <p className="small muted">{L(`We sent a 6-digit code to your phone to confirm ${egp(tx.amount)}.`, `بعتنالك كود 6 أرقام على موبايلك علشان تأكد ${egp(tx.amount)}.`)}</p>
      </div>

      {sms && (
        <div className="sms" aria-label="Simulated SMS">
          <img className="app-icon" src="/ershak-coin2.png" alt="" />
          <div className="stack" style={{ gap: 2 }}>
            <div className="between"><span className="tiny" style={{ fontWeight: 600 }}>ERSHAK · SMS</span><span className="tiny muted">{L('now', 'دلوقتي')}</span></div>
            <p className="small">{sms.message}</p>
          </div>
        </div>
      )}

      <div className="stack">
        <label className="label" htmlFor="otp-0">{L('Verification code', 'كود التأكيد')}</label>
        <div className="otp">
          {digits.map((d, i) => (
            <input key={i} id={`otp-${i}`} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} maxLength={6}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()} />
          ))}
        </div>
        <div className="between">
          {error ? <p className="error-text">{error}</p> : <span />}
          <span className={`tiny num ${left < 30 ? 'bad' : 'muted'}`}>
            {left > 0 ? `${L('Expires in', 'بينتهي بعد')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : L('Code expired', 'الكود انتهى')}
          </span>
        </div>
      </div>

      <Reasons reasons={reasons} score={score} />
      <button className="btn primary block" disabled={busy}>{busy ? L('Checking…', 'بيتأكد…') : L('Confirm', 'تأكيد')}</button>
    </form>
  );
}

/** "Sedo w estareya7": the transfer is paused until an officer reviews it. */
export function Held({ tx, reasons, score, onFinish }) {
  const L = useL();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    play('alert');
  }, []);

  const notMe = async () => {
    setBusy(true);
    try {
      const t = await post(`/api/transactions/${tx.id}/cancel`, { freezeAccount: true });
      toast(L('Cancelled. We froze the account to keep it safe.', 'اتلغى. وجمّدنا الحساب علشان أمانك.'), 'bad');
      onFinish?.(t);
      navigate('/accounts');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div className="tx-icon" style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--card)', border: '1px solid var(--line)' }}>
          <Icon name="shieldAlert" size={34} color="var(--bad)" />
        </div>
        <h1>{L('Transfer on hold', 'التحويل متوقف')}</h1>
        <Proverb>الباب اللي يجيلك منه الريح، سدّه واستريح</Proverb>
        <p className="small muted">{L('We paused this transfer until a bank officer reviews it. Your money is held, not sent.', 'وقفنا التحويل لحد ما موظف البنك يراجعه. فلوسك محجوزة، مش متبعتة.')}</p>
      </div>
      <div className="card stack">
        <div className="between"><span className="small muted">{L('Amount', 'المبلغ')}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{egp(tx.amount)}</span></div>
        <div className="between small"><span className="muted">{L('Reference', 'الرقم المرجعي')}</span><span className="num">{tx.reference}</span></div>
      </div>
      <Reasons reasons={reasons} score={score} />
      <div className="stack">
        <button type="button" className="btn primary block" onClick={() => { toast(L('Okay. An officer will review it shortly.', 'تمام. موظف هيراجعه قريب.')); navigate('/accounts'); }}>{L('It was me', 'أيوه أنا')}</button>
        <button type="button" className="btn danger block" disabled={busy} onClick={notMe}>{L('Not me — cancel and lock my account', 'مش أنا، الغي واقفل حسابي')}</button>
      </div>
    </div>
  );
}
