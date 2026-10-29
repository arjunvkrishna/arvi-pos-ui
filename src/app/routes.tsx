import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { useSession } from '../api/session';
import { LoginScreen } from '../auth/LoginScreen';
import { canOpenTab, defaultTab, tabFromHash, TABS } from '../auth/tabs';
import { ComingSoon } from '../features/shell/ComingSoon';
import { PlatformShell } from '../features/platform/PlatformShell';
import { isPublicMenuLink } from './publicMenuLink';
import { ForbiddenPage, NotFoundPage } from './errors/ErrorPages';
import { AppShell } from './layout/AppShell';

import { Skeleton } from '../components/ui';

// One chunk per screen: the sign-in page and the shell stay small, and a screen's code (e.g. charts) loads only when it is opened.
const named = <T extends string>(load: () => Promise<Record<T, React.ComponentType>>, key: T) => lazy(() => load().then((m) => ({ default: m[key] })));
const UsersPage = named(() => import('../features/users/UsersPage'), 'UsersPage');
const PosPage = named(() => import('../features/pos/PosGate'), 'PosGate');
const MenuPage = named(() => import('../features/menu/MenuPage'), 'MenuPage');
const InventoryPage = named(() => import('../features/inventory/InventoryPage'), 'InventoryPage');
const StaffPage = named(() => import('../features/staff/StaffPage'), 'StaffPage');
const AttendancePage = named(() => import('../features/attendance/AttendancePage'), 'AttendancePage');
const ExpensesPage = named(() => import('../features/expenses/ExpensesPage'), 'ExpensesPage');
const GstPage = named(() => import('../features/gst/GstPage'), 'GstPage');
const TelegramPage = named(() => import('../features/telegram/TelegramPage'), 'TelegramPage');
const AuditPage = named(() => import('../features/audit/AuditPage'), 'AuditPage');
const AnalyticsPage = named(() => import('../features/analytics/AnalyticsPage'), 'AnalyticsPage');
const BillsPage = named(() => import('../features/bills/BillsPage'), 'BillsPage');
const CustomersPage = named(() => import('../features/customers/CustomersPage'), 'CustomersPage');
const OwnerDashboardPage = named(() => import('../features/owner-dashboard/OwnerDashboardPage'), 'OwnerDashboardPage');
const SchedulingPage = named(() => import('../features/scheduling/SchedulingPage'), 'SchedulingPage');
const DocumentsPage = named(() => import('../features/documents/DocumentsPage'), 'DocumentsPage');
const SuppliersPage = named(() => import('../features/suppliers/SuppliersPage'), 'SuppliersPage');
const StockLinksPage = named(() => import('../features/stocklinks/StockLinksPage'), 'StockLinksPage');
const KitchenPage = named(() => import('../features/kitchen/KitchenPage'), 'KitchenPage');
const OutletsPage = named(() => import('../features/outlets/OutletsPage'), 'OutletsPage');
const SettingsPage = named(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const PublicMenuPage = named(() => import('../features/public-menu/PublicMenuPage'), 'PublicMenuPage');

const LAST_TAB_KEY = 'arvi_active_tab';

/** Opens the screen the user last used (if they may still open it), otherwise their role's default screen. */
function Landing() {
  const user = useSession((s) => s.user)!;
  let target = defaultTab(user);
  // A link like /next/#menu must win over "last used" and the role default (old bookmarks).
  const fromHash = tabFromHash(window.location.hash);
  if (fromHash) return <Navigate to={`/${fromHash}`} replace state={{ fromLink: true }} />;
  try {
    const saved = (localStorage.getItem(LAST_TAB_KEY) || '').replace(/^tab-/, '');
    if (saved && canOpenTab(user, saved)) target = saved as typeof target;
  } catch { /* ignore */ }
  return <Navigate to={`/${target}`} replace />;
}

const SCREENS = { pos: PosPage, users: UsersPage, customers: CustomersPage, 'owner-dashboard': OwnerDashboardPage, scheduling: SchedulingPage, documents: DocumentsPage, menu: MenuPage, inventory: InventoryPage, suppliers: SuppliersPage, expenses: ExpensesPage, gst: GstPage, telegram: TelegramPage, audit: AuditPage, analytics: AnalyticsPage, bills: BillsPage, staff: StaffPage, attendance: AttendancePage, stocklinks: StockLinksPage, kds: KitchenPage, outlets: OutletsPage, settings: SettingsPage } as const;

function TabRoute() {
  const user = useSession((s) => s.user)!;
  const { tab = '' } = useParams();
  const legacyLink = (useLocation().state as { fromLink?: boolean } | null)?.fromLink === true;
  const allowed = canOpenTab(user, tab);
  useEffect(() => {
    if (allowed) { try { localStorage.setItem(LAST_TAB_KEY, `tab-${tab}`); } catch { /* ignore */ } }
  }, [allowed, tab]);
  if (!TABS.some((t) => t.id === tab)) return <NotFoundPage />;                 // not a screen of this app
  // A screen the role may not open is never shown. An old #link falls back to the person's own screen quietly; a typed address gets the "staff only" page.
  if (!allowed) return legacyLink ? <Navigate to={`/${defaultTab(user)}`} replace /> : <ForbiddenPage />;
  const Screen = SCREENS[tab as keyof typeof SCREENS];
  if (Screen) return <Suspense fallback={<div className="card"><Skeleton rows={6} /></div>}><Screen /></Suspense>;
  return <ComingSoon tab={TABS.find((t) => t.id === tab)!} />;
}

export function AppRoutes() {
  const user = useSession((s) => s.user);
  const { pathname, search } = useLocation();
  // The customer menu (the table QR code, /menu?cafe=<code>) is public: no sign-in, and nothing of the staff app is loaded.
  // Plain /menu without a cafe code is the staff screen "Menu & Pricing", so the two never collide.
  if (isPublicMenuLink(pathname, search)) return <Suspense fallback={<div className="min-h-screen bg-canvas" />}><PublicMenuPage /></Suspense>;
  if (!user) return <LoginScreen />;
  if (user.platform) return <PlatformShell />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path=":tab" element={<TabRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
