import { useEffect, useState } from 'react';
import { get, post } from '../api';
import AccountPicker from '../components/AccountPicker';
import Outcome from '../components/Outcome';
import { AmountInput, ErrorCard, Skeleton, TopBar, useLoader } from '../components/ui';
import { egp, typeLabel } from '../format';
import { useL } from '../prefs';

const FEE = 2;

/** Transfer flow: details → review → result (done, code, or held). */
export default function Transfer() {
  const L = useL();
  const accounts = useLoader(() => get('/api/accounts'));
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ fromAccountId: null, toAccountNumber: '', amount: '', note: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const first = accounts.data?.find((a) => a.status === 'ACTIVE');
    if (first && !form.fromAccountId) setForm((f) => ({ ...f, fromAccountId: first.id }));
  }, [accounts.data, form.fromAccountId]);

  const from = accounts.data?.find((a) => a.id === form.fromAccountId);
  const number = form.toAccountNumber.replace(/\s/g, '');
  const ownTarget = accounts.data?.find((a) => a.accountNumber === number);
  const fee = ownTarget ? 0 : FEE;
  const total = Number(form.amount || 0) + fee;

  const validate = () => {
    const e = {};
    if (!from) e.from = L('Choose an account.', 'اختار حساب.');
    if (!/^\d{12}$/.test(number)) e.to = L('Account numbers are 12 digits.', 'رقم الحساب 12 رقم.');
    else if (from && number === from.accountNumber) e.to = L("You can't send to the same account.", 'مينفعش تحوّل لنفس الحساب.');
    if (!(Number(form.amount) > 0)) e.amount = L('Enter an amount.', 'اكتب المبلغ.');
    else if (from && total > Number(from.availableBalance)) e.amount = L(`Not enough balance. Available: ${egp(from.availableBalance)}`, `الرصيد مش كفاية. المتاح: ${egp(from.availableBalance)}`);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const send = async () => {
    setBusy(true);
    setServerError('');
    try {
      const r = await post('/api/transactions/transfer', { ...form, toAccountNumber: number });
      setResult(r);
      setStep('result');
    } catch (err) {
      setServerError(err.message);
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'result') {
    return <main className="page narrow"><Outcome result={result} title={L('Transfer', 'التحويل')} /></main>;
  }

  return (
    <main className="page narrow">
      <TopBar title={step === 'form' ? L('Transfer', 'تحويل') : L('Review transfer', 'راجع التحويل')}
        onBack={step === 'review' ? () => setStep('form') : undefined} />
      {accounts.loading && <Skeleton height={300} />}
      {accounts.error && <ErrorCard error={accounts.error} onRetry={accounts.reload} />}
      {serverError && <div role="alert" className="alert bad small">{serverError}</div>}

      {accounts.data && step === 'form' && (
        <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); if (validate()) setStep('review'); }} noValidate>
          <AccountPicker accounts={accounts.data} value={form.fromAccountId} onChange={(id) => setForm({ ...form, fromAccountId: id })} />
          {errors.from && <p className="error-text">{errors.from}</p>}
          <div className="field">
            <label htmlFor="to">{L('To account number', 'رقم الحساب اللي هتحوّله')}</label>
            <input id="to" className={`input num${errors.to ? ' invalid' : ''}`} inputMode="numeric" placeholder="1001 2345 6789"
              value={form.toAccountNumber} onChange={(e) => setForm({ ...form, toAccountNumber: e.target.value.replace(/[^\d\s]/g, '') })} />
            {errors.to ? <p className="error-text">{errors.to}</p>
              : <p className="hint">{ownTarget ? L(`Your own ${typeLabel[ownTarget.type].toLowerCase()} · no fee`, `${typeLabel[ownTarget.type]} بتاعك · من غير رسوم`) : L('Transfers to other people cost EGP 2.00', 'التحويل لحد تاني رسومه 2 جنيه')}</p>}
            {accounts.data.length > 1 && (
              <div className="chips">
                {accounts.data.filter((a) => a.id !== form.fromAccountId).map((a) => (
                  <button key={a.id} type="button" className="chip" onClick={() => setForm({ ...form, toAccountNumber: a.accountNumber })}>
                    {L(`My ${a.type.toLowerCase()}`, typeLabel[a.type])} {a.maskedNumber}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="amount">{L('Amount', 'المبلغ')}</label>
            <AmountInput id="amount" value={form.amount} invalid={!!errors.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            {errors.amount && <p className="error-text">{errors.amount}</p>}
          </div>
          <div className="field">
            <label htmlFor="note">{L('Note (optional)', 'ملاحظة (اختياري)')}</label>
            <input id="note" className="input" maxLength={120} placeholder={L('Rent share', 'نصيبي في الإيجار')} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="btn primary block">{L('Continue', 'كمّل')}</button>
        </form>
      )}

      {accounts.data && step === 'review' && (
        <div className="stack-lg">
          <div className="card stack" style={{ gap: 14 }}>
            <div className="stack" style={{ alignItems: 'center', gap: 4, padding: '8px 0' }}>
              <p className="small muted">{L("You're sending", 'هتحوّل')}</p>
              <p className="num" style={{ fontSize: 32, fontWeight: 700 }}>{egp(form.amount)}</p>
            </div>
            <hr className="divider" />
            <div className="between small"><span className="muted">{L('From', 'من')}</span><span>{typeLabel[from.type]} {from.maskedNumber}</span></div>
            <div className="between small"><span className="muted">{L('To', 'لـ')}</span><span className="num">{ownTarget ? `${L('Your', 'حسابك')} ${ownTarget.maskedNumber}` : `•••• ${number.slice(-4)}`}</span></div>
            <div className="between small"><span className="muted">{L('Fee', 'الرسوم')}</span><span className="num">{egp(fee)}</span></div>
            {form.note && <div className="between small"><span className="muted">{L('Note', 'ملاحظة')}</span><span>{form.note}</span></div>}
            <hr className="divider" />
            <div className="between"><span style={{ fontWeight: 600 }}>{L('Total', 'الإجمالي')}</span><span className="num" style={{ fontWeight: 700 }}>{egp(total)}</span></div>
          </div>
          <p className="tiny muted" style={{ textAlign: 'center' }}>{L('Fraud Guard checks every transfer before it leaves your account.', 'Fraud Guard بيراجع كل تحويل قبل ما يخرج من حسابك.')}</p>
          <div className="stack">
            <button type="button" className="btn primary block" disabled={busy} onClick={send}>{busy ? L('Sending…', 'بيحوّل…') : L(`Send ${egp(form.amount)}`, `حوّل ${egp(form.amount)}`)}</button>
            <button type="button" className="btn block" disabled={busy} onClick={() => setStep('form')}>{L('Edit', 'تعديل')}</button>
          </div>
        </div>
      )}
    </main>
  );
}
