import { useEffect, useState } from 'react';
import { get } from '../api';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Icon from '../components/Icon';
import { Proverb } from '../components/ui';
import { time } from '../format';
import { useL } from '../prefs';

export default function Login() {
  const L = useL();
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoLogin, setDemoLogin] = useState(false);
  useEffect(() => { get('/api/config').then((c) => setDemoLogin(!!c.demoLogin)).catch(() => {}); }, []);

  if (ready && user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError({ message: L('Enter your username and password.', 'اكتب اسم المستخدم والباسورد.') });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await login(form.username.trim(), form.password);
      navigate(u.mustChangePassword ? '/change-password' : u.role === 'ADMIN' ? '/admin' : '/');
    } catch (err) {
      setError(err);
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  };

  const locked = error?.code === 'USER_LOCKED';

  return (
    <div className="auth">
      <div className="brand" style={{ paddingTop: 12 }}>
        <img src={document.documentElement.dataset.theme === 'dark' ? '/ershak-logo2-dark.png' : '/ershak-logo2.png'} alt="قرشك Ershak" className="logo-img" style={{ marginBottom: 6 }} />
        <p className="small muted">صوت ضميرك في فلوسك · Your money’s conscience</p>
      </div>

      {error && (
        <div role="alert" className="alert bad">
          <Icon name="lock" color="var(--bad)" style={{ marginTop: 2 }} />
          <div className="stack" style={{ gap: 2 }}>
            {locked && <Proverb lg style={{ textAlign: 'left' }}>التالتة تابتة</Proverb>}
            <p className="small" style={{ color: locked ? 'var(--muted)' : 'var(--text)' }}>
              {locked
                ? L(`Too many wrong passwords. We locked your login to keep it safe. Try again at ${time(error.body.lockedUntil)}.`, `باسورد غلط كذا مرة، فقفلنا الدخول علشان أمانك. جرّب تاني الساعة ${time(error.body.lockedUntil)}.`)
                : error.message}
            </p>
          </div>
        </div>
      )}

      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="username">{L('Username', 'اسم المستخدم')}</label>
          <input id="username" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">{L('Password', 'الباسورد')}</label>
          <input id="password" type="password" className="input" autoComplete="current-password"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? L('Logging in…', 'بيدخل…') : L('Log in', 'دخول')}</button>
      </form>

      <div className="spacer" />

      <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
        <p className="small muted">{L('New here?', 'أول مرة؟')} <Link to="/register" style={{ fontWeight: 600 }}>{L('Open an account', 'اعمل حساب')}</Link></p>
        {demoLogin && (<>
        <button type="button" className="btn ghost sm" onClick={() => setShowDemo(!showDemo)}>
          {showDemo ? L('Hide demo accounts', 'اخفي حسابات التجربة') : L('Try the demo', 'جرّب الديمو')}
        </button>
        {showDemo && (
          <div className="card tight stack small" style={{ width: '100%', gap: 8 }}>
            <button type="button" className="between btn sm" onClick={() => setForm({ username: 'omar.ahmed', password: 'Ershak@2026' })}>
              <span>{L('Customer', 'عميل')}</span><span className="muted">omar.ahmed</span>
            </button>
            <button type="button" className="between btn sm" onClick={() => setForm({ username: 'admin', password: 'Admin@2026' })}>
              <span>{L('Bank officer', 'موظف البنك')}</span><span className="muted">admin</span>
            </button>
          </div>
        )}
        </>)}
        <p className="row tiny muted" style={{ gap: 6 }}>
          <Icon name="shield" size={14} /> {L('Passwords are hashed with PBKDF2. Only you see your data.', 'الباسورد متشفّر بـ PBKDF2، ومحدش يشوف بياناتك غيرك.')}
        </p>
      </div>
    </div>
  );
}
