import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { ArrowLeft } from 'lucide-react';
import { amount, statusLabel, statusTone, time } from '../format';

export function TopBar({ title, onBack, right }) {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <button type="button" className="icon-btn" aria-label="Back"
        onClick={() => (onBack ? onBack() : window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        <ArrowLeft size={20} className="flip" />
      </button>
      <h1>{title}</h1>
      <div className="spacer" />
      {right}
    </div>
  );
}

export function Proverb({ children, lg, style }) {
  return (
    <p lang="ar" dir="rtl" className={`proverb${lg ? ' lg' : ''}`} style={style}>
      {children}
    </p>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${statusTone[status] || ''}`}>{statusLabel[status] || status}</span>;
}

const txIcon = (tx) => {
  if (tx.status === 'PENDING_REVIEW' || tx.status === 'REJECTED') return { name: 'shieldX', color: 'var(--bad)' };
  if (tx.status === 'PENDING_OTP') return { name: 'shieldAlert', color: 'var(--warn)' };
  if (tx.type === 'GOAL_DEPOSIT' || tx.type === 'GOAL_WITHDRAW') return { name: 'goal', color: 'var(--accent)' };
  if (tx.direction === 'IN') return { name: 'in', color: 'var(--ok)' };
  return { name: 'out', color: 'var(--text)' };
};

export function TxRow({ tx }) {
  const icon = txIcon(tx);
  const out = tx.direction === 'OUT';
  const pending = tx.status !== 'COMPLETED';
  const tone = tx.status === 'COMPLETED' ? (out ? '' : 'ok') : statusTone[tx.status];
  const sub = pending ? `${time(tx.createdAt)} · ${statusLabel[tx.status]}` : `${time(tx.createdAt)} · ${typeName(tx)}`;
  return (
    <Link to={`/tx/${tx.id}`} className="tx">
      <div className="tx-icon"><Icon name={icon.name} size={18} color={icon.color} /></div>
      <div className="tx-main">
        <p className="tx-title">{tx.title}</p>
        <p className={`tiny ${pending ? tone : 'muted'}`}>{sub}</p>
      </div>
      <p className={`tx-amount ${tone}`} style={tx.status === 'REJECTED' ? { textDecoration: 'line-through' } : undefined}>
        {out ? '-' : '+'}{amount(tx.amount)}
      </p>
    </Link>
  );
}

export const typeName = (tx) => (document.documentElement.lang === 'ar'
  ? { DEPOSIT: 'إيداع', WITHDRAW: 'سحب', TRANSFER: 'تحويل', GOAL_DEPOSIT: 'هدف ادخار', GOAL_WITHDRAW: 'هدف ادخار', INTEREST: 'فوايد (قديم)' }[tx.type]
  : null) ||
  ({
    DEPOSIT: 'Deposit',
    WITHDRAW: 'Withdrawal',
    TRANSFER: 'Transfer',
    GOAL_DEPOSIT: 'Savings goal',
    GOAL_WITHDRAW: 'Savings goal',
    INTEREST: 'Interest',
  })[tx.type] || tx.type;

export function Skeleton({ height = 60, style }) {
  return <div className="skeleton" style={{ height, ...style }} />;
}

export function Empty({ icon = 'coin', title, children, action }) {
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}>
      <div className="tx-icon" style={{ width: 52, height: 52, borderRadius: 16 }}>
        <Icon name={icon} size={24} color="var(--accent)" />
      </div>
      <h3>{title}</h3>
      {children}
      {action}
    </div>
  );
}

/** Amount input that only accepts numbers with up to 2 decimals. */
export function AmountInput({ id, value, onChange, invalid, autoFocus }) {
  return (
    <div style={{ position: 'relative' }}>
      <span className="muted" style={{ position: 'absolute', left: 16, top: 22, fontSize: 15, fontWeight: 500, direction: 'ltr' }}>EGP</span>
      <input dir="ltr"
        id={id}
        className={`input amount num${invalid ? ' invalid' : ''}`}
        style={{ paddingLeft: 58 }}
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/,/g, '');
          if (v === '' || /^\d{0,9}(\.\d{0,2})?$/.test(v)) onChange(v);
        }}
      />
    </div>
  );
}

export function useLoader(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = () => {
    setState((s) => ({ ...s, loading: true }));
    return fn()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload: load };
}

export function ErrorCard({ error, onRetry }) {
  return (
    <div className="alert bad">
      <Icon name="shieldAlert" color="var(--bad)" />
      <div className="stack" style={{ gap: 8 }}>
        <p className="small">{error?.message || 'Something went wrong.'}</p>
        {onRetry && <button type="button" className="btn sm" onClick={onRetry}>{document.documentElement.lang === 'ar' ? 'جرّب تاني' : 'Try again'}</button>}
      </div>
    </div>
  );
}
