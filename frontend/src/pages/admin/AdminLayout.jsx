import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth';
import Icon from '../../components/Icon';
import { useL, usePrefs } from '../../prefs';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { prefs, update } = usePrefs();
  const L = useL();
  const links = [
    { to: '/admin', icon: 'grid', label: L('Overview', 'نظرة عامة'), end: true },
    { to: '/admin/reviews', icon: 'shield', label: L('Review queue', 'قايمة المراجعة') },
    { to: '/admin/customers', icon: 'users', label: L('Customers', 'العملاء') },
    { to: '/admin/audit', icon: 'doc', label: L('Audit log', 'سجل المراجعة') },
    { to: '/admin/rules', icon: 'sliders', label: L('Fraud rules', 'قواعد الاحتيال') },
  ];
  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Admin">
        <div className="row brand-row" style={{ padding: '0 8px 20px', gap: 10 }}>
          <img src="/ershak-coin2.png" alt="" width="36" height="36" style={{ borderRadius: "50%" }} />
          <div>
            <p style={{ fontWeight: 700 }}>{L('Ershak', 'قرشك')}</p>
            <p className="tiny muted">{L('Admin console', 'لوحة الموظفين')}</p>
          </div>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <Icon name={l.icon} size={18} />{l.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="brand-row stack" style={{ gap: 8, padding: '12px 8px 0' }}>
          <div className="seg" style={{ width: '100%' }}>
            <button type="button" className={prefs.lang === 'ar' ? 'on' : ''} onClick={() => update({ lang: 'ar' })}>عربي</button>
            <button type="button" className={prefs.lang === 'en' ? 'on' : ''} onClick={() => update({ lang: 'en' })}>EN</button>
          </div>
          <p className="tiny muted">{L('Signed in as', 'داخل باسم')} <span dir="ltr">{user?.username}</span></p>
          <button type="button" className="btn sm" onClick={logout}><Icon name="logout" size={16} />{L('Log out', 'خروج')}</button>
        </div>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
