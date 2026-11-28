import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Icon from './components/Icon';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import Accounts from './pages/Accounts';
import CoachHome from './pages/coach/CoachHome';
import Expenses from './pages/coach/Expenses';
import Chat from './pages/coach/Chat';
import Settings, { Setup } from './pages/coach/Settings';
import Onboarding from './pages/coach/Onboarding';
import { Budget, Zakat } from './pages/coach/Tools';
import QuickAdd from './components/QuickAdd';
import { useQuickAdd } from './coach';
import { usePrefs } from './prefs';
import { Home as HomeI, MessageCircle, Plus, ReceiptText, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { enablePush, permission, savePushPrefs } from './push';
import { isNative, onReminderTap } from './native';
import { useNavigate } from 'react-router-dom';
import Transfer from './pages/Transfer';
import Move from './pages/Move';
import Activity from './pages/Activity';
import TransactionDetail from './pages/TransactionDetail';
import Goals from './pages/Goals';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Reviews from './pages/admin/Reviews';
import Customers from './pages/admin/Customers';
import AuditLog from './pages/admin/AuditLog';
import Rules from './pages/admin/Rules';

function Splash() {
  return (
    <div className="auth" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <img src="/ershak-coin2.png" alt="Ershak" width="72" height="72" className="coin" style={{ width: 72, height: 72 }} />
    </div>
  );
}

/** Guards a group of routes: must be logged in, must have changed a forced password, right role. */
function Guard({ role }) {
  const { user, ready } = useAuth();
  const { prefs } = usePrefs();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to={prefs.onboarded ? '/login' : '/welcome'} replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (role === 'ADMIN' && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  if (role === 'CUSTOMER' && user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function CustomerLayout() {
  const { t, dark, prefs } = usePrefs();
  const { show } = useQuickAdd();
  const [params, setParams] = useSearchParams();

  // Opened from a reminder ("/?add=1") or the app shortcut: go straight to quick add.
  useEffect(() => {
    if (params.get('add') === '1') {
      show();
      setParams({}, { replace: true });
    }
  }, [params, setParams, show]);

  const navigate = useNavigate();
  useEffect(() => onReminderTap(navigate), [navigate]);

  // If this device already allowed notifications, make sure the server knows it (after a login, say).
  useEffect(() => {
    if (!isNative() && permission() === 'granted') {
      enablePush({ silent: true }).then(() => savePushPrefs(prefs.reminder)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tabs = [
    { to: '/', icon: HomeI, label: t('home'), end: true },
    { to: '/expenses', icon: ReceiptText, label: t('expenses') },
    null,
    { to: '/goals', icon: Target, label: t('goals') },
    { to: '/chat', icon: MessageCircle, label: t('ershak') },
  ];
  return (
    <div className="app">
      <Outlet />
      <nav className="tabbar" aria-label="Main">
        <img src={dark ? '/ershak-logo2-dark.png' : '/ershak-logo2.png'} alt="قرشك" className="brand-side" style={{ width: 150 }} />
        {tabs.map((tb) => (tb ? (
          <NavLink key={tb.to} to={tb.to} end={tb.end}>
            <tb.icon size={22} strokeWidth={1.9} />
            {tb.label}
          </NavLink>
        ) : (
          <button key="fab" type="button" className="fab" aria-label={t('add')} onClick={() => show()}>
            <Plus size={26} strokeWidth={2.4} /><span className="fab-label">{t('add')}</span>
          </button>
        )))}
      </nav>
      <QuickAdd />
    </div>
  );
}

function SetupGate() {
  const { prefs } = usePrefs();
  return prefs.setupDone ? <Outlet /> : <Navigate to="/setup" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route element={<Guard role="CUSTOMER" />}>
        <Route path="setup" element={<Setup />} />
        <Route element={<SetupGate />}>
          <Route element={<CustomerLayout />}>
            <Route index element={<CoachHome />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="goals" element={<Goals />} />
            <Route path="chat" element={<Chat />} />
          </Route>
        </Route>
        <Route element={<div className="app"><Outlet /><QuickAdd /></div>}>
          <Route path="accounts" element={<Accounts />} />
          <Route path="activity" element={<Activity />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="budget" element={<Budget />} />
          <Route path="zakat" element={<Zakat />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="move/:mode" element={<Move />} />
          <Route path="tx/:id" element={<TransactionDetail />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route path="/admin" element={<Guard role="ADMIN" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="customers" element={<Customers />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="rules" element={<Rules />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
