import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { post } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Proverb } from '../components/ui';
import { useL } from '../prefs';

/** Forced on first login for the default officer account; also reachable from Profile. */
export default function ChangePassword() {
  const L = useL();
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && !user) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError(L("The new passwords don't match.", 'الباسوردين الجداد مش زي بعض.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await post('/api/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      const u = await refresh();
      toast(L('Password changed.', 'الباسورد اتغيّر.'));
      navigate(u?.role === 'ADMIN' ? '/admin' : '/settings');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 6 }}>
        <img src="/ershak-coin2.png" alt="" className="coin" style={{ width: 48, height: 48 }} />
        <h1>{user?.mustChangePassword ? L('Set your own password', 'حط باسورد خاص بيك') : L('Change password', 'تغيير الباسورد')}</h1>
        {user?.mustChangePassword && <p className="small muted">{L('This account still uses the default password. Choose a new one to continue.', 'الحساب ده لسه بالباسورد الافتراضي. اختار واحد جديد علشان تكمل.')}</p>}
        <Proverb>الحرص واجب</Proverb>
      </div>
      {error && <div role="alert" className="alert bad small">{error}</div>}
      <form className="stack-lg" onSubmit={submit}>
        <div className="field">
          <label htmlFor="current">{L('Current password', 'الباسورد الحالي')}</label>
          <input id="current" type="password" className="input" autoComplete="current-password"
            value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new">{L('New password', 'الباسورد الجديد')}</label>
          <input id="new" type="password" className="input" autoComplete="new-password"
            value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="hint">{L('8+ characters with upper case, lower case and a number.', '8 حروف أو أكتر، فيهم كابيتال وسمول ورقم.')}</p>
        </div>
        <div className="field">
          <label htmlFor="confirm">{L('Repeat new password', 'اكتب الباسورد الجديد تاني')}</label>
          <input id="confirm" type="password" className="input" autoComplete="new-password"
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? L('Saving…', 'بيحفظ…') : L('Save password', 'احفظ الباسورد')}</button>
      </form>
    </div>
  );
}
