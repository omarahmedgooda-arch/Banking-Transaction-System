import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth';
import Icon from '../../components/Icon';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const links = [
    { to: '/admin', icon: 'grid', label: 'Overview', end: true },
    { to: '/admin/reviews', icon: 'shield', label: 'Review queue' },
    { to: '/admin/customers', icon: 'users', label: 'Customers' },
    { to: '/admin/audit', icon: 'doc', label: 'Audit log' },
    { to: '/admin/rules', icon: 'sliders', label: 'Fraud rules' },
  ];
  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Admin">
        <div className="row brand-row" style={{ padding: '0 8px 20px', gap: 10 }}>
          <img src="/ershak-coin2.png" alt="" width="36" height="36" style={{ borderRadius: "50%" }} />
          <div>
            <p style={{ fontWeight: 700 }}>Ershak</p>
            <p className="tiny muted">Admin console</p>
          </div>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <Icon name={l.icon} size={18} />{l.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="brand-row stack" style={{ gap: 8, padding: '12px 8px 0' }}>
          <p className="tiny muted">Signed in as {user?.username}</p>
          <button type="button" className="btn sm" onClick={logout}><Icon name="logout" size={16} />Log out</button>
        </div>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
