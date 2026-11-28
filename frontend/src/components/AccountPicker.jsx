import { amount, typeLabel } from '../format';
import { useL } from '../prefs';

/** Radio-style cards to choose one of the customer's accounts. */
export default function AccountPicker({ accounts, value, onChange, label, showAvailable = true }) {
  const L = useL();
  label = label || L('From', 'من');
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 8 }}>{label}</legend>
      <div className="stack" style={{ gap: 8 }}>
        {accounts.map((a) => {
          const on = a.id === value;
          const frozen = a.status !== 'ACTIVE';
          return (
            <label key={a.id} className="card tight between" style={{
              cursor: frozen ? 'not-allowed' : 'pointer', opacity: frozen ? 0.55 : 1,
              borderColor: on ? 'var(--primary-text)' : undefined, boxShadow: on ? '0 0 0 3px color-mix(in srgb, var(--primary-text) 15%, transparent)' : undefined,
            }}>
              <input type="radio" name={label} className="sr-only" checked={on} disabled={frozen} onChange={() => onChange(a.id)} />
              <div>
                <p style={{ fontWeight: 500 }}>{typeLabel[a.type]}</p>
                <p className="tiny muted num">{a.maskedNumber}{frozen ? L(' · Frozen', ' · مجمّد') : ''}</p>
              </div>
              {showAvailable && (
                <div style={{ textAlign: 'end' }}>
                  <p className="num" style={{ fontWeight: 600 }}>{amount(a.availableBalance)}</p>
                  <p className="tiny muted">{L('available', 'متاح')}</p>
                </div>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
