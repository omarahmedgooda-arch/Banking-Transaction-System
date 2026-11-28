import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api';
import { useAuth } from '../auth';
import Icon from '../components/Icon';
import { Proverb } from '../components/ui';
import { useL } from '../prefs';

const rules = [
  { test: (p) => p.length >= 8, label: '8+ characters', ar: '8 حروف أو أكتر' },
  { test: (p) => /[A-Z]/.test(p), label: 'Upper case', ar: 'حرف كابيتال' },
  { test: (p) => /[a-z]/.test(p), label: 'Lower case', ar: 'حرف سمول' },
  { test: (p) => /\d/.test(p), label: 'A number', ar: 'رقم' },
];

export default function Register() {
  const L = useL();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = L('Enter your full name.', 'اكتب اسمك بالكامل.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = L('Enter a valid email.', 'اكتب إيميل صحيح.');
    if (!/^01[0125]\d{8}$/.test(form.phone.replace(/\s/g, ''))) e.phone = L('Use an Egyptian mobile like 01012345678.', 'اكتب رقم موبايل مصري زي 01012345678.');
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(form.username)) e.username = L('3-30 letters, numbers, dots or underscores.', 'من 3 لـ 30 حرف أو رقم أو نقطة أو _');
    if (!rules.every((r) => r.test(form.password))) e.password = L('Your password needs all four checks.', 'الباسورد لازم يحقق الأربع شروط.');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setServerError('');
    try {
      await post('/api/auth/register', { ...form, phone: form.phone.replace(/\s/g, '') });
      await login(form.username, form.password);
      navigate('/profile?open=1');
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input id={key} className={`input${errors[key] ? ' invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <p className="error-text">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="auth">
      <div className="topbar">
        <Link to="/login" className="icon-btn" aria-label="Back"><Icon name="back" style={{ transform: L('none', 'scaleX(-1)') }} /></Link>
        <img src="/ershak-coin2.png" alt="" width="36" height="36" className="coin" style={{ width: 36, height: 36 }} />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{L('Open your Ershak account', 'اعمل حسابك في قرشك')}</h1>
        <p className="small muted">{L('Takes a minute. No fees, no interest.', 'دقيقة واحدة. من غير رسوم ولا فوايد.')}</p>
      </div>
      {serverError && <div role="alert" className="alert bad small">{serverError}</div>}
      <form className="stack-lg" onSubmit={submit} noValidate>
        {field('fullName', L('Full name', 'الاسم بالكامل'), { autoComplete: 'name', placeholder: 'Omar Ahmed' })}
        {field('email', L('Email', 'الإيميل'), { type: 'email', autoComplete: 'email', placeholder: 'name@example.com' })}
        {field('phone', L('Mobile number', 'رقم الموبايل'), { inputMode: 'tel', autoComplete: 'tel', placeholder: '01012345678' })}
        {field('username', L('Username', 'اسم المستخدم'), { autoCapitalize: 'none', autoComplete: 'username', placeholder: 'omar.ahmed' })}
        <div className="field">
          <label htmlFor="password">{L('Password', 'الباسورد')}</label>
          <input id="password" type="password" className={`input${errors.password ? ' invalid' : ''}`}
            autoComplete="new-password" value={form.password} onChange={set('password')} />
          <div className="chips">
            {rules.map((r) => (
              <span key={r.label} className={`badge ${r.test(form.password) ? 'ok' : ''}`}>
                {r.test(form.password) && <Icon name="check" size={12} stroke={2.4} />} {L(r.label, r.ar)}
              </span>
            ))}
          </div>
          {errors.password && <p className="error-text">{errors.password}</p>}
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? L('Creating…', 'بنعمل الحساب…') : L('Create account', 'اعمل الحساب')}</button>
      </form>
    </div>
  );
}
