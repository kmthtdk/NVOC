// ============================================================================
// App — the shell.
// - Gates the whole UI behind authentication (Login until a session exists).
// - Maps the URL to the page being shown; navigation state lives in the URL, so
//   tickets are linkable, pages are bookmarkable, and refresh keeps your place.
// - Owns a `reloadKey` counter: any successful mutation (create/update/comment)
//   bumps it, and every data-fetching child refetches on [params, reloadKey].
// - Route-guards the IT Admin workspace (UX only — the API enforces the roles).
// The two pages themselves live in src/pages/.
// ============================================================================

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Ticket, CategorySpec } from './types';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import type { PortalView, UserTab } from './navigation';
import type { DeviceSubTab } from './navigation';
import { ADMIN_TAB_PATHS, adminTabFromPath } from './navigation';

import Login from './components/Login';
import UserProfile from './components/UserProfile';
import TicketDetailModal from './components/TicketDetailModal';
import ConfirmationModal from './components/ConfirmationModal';
import { LoadingPanel } from './components/ui/Spinner';
import UserPortal from './pages/UserPortal';

// The admin workspace pulls in the device inventory, the pivot table and both
// report pages. A requester filing a ticket never opens any of it, so it is
// split out of the initial bundle instead of shipped to everyone.
const AdminWorkspace = lazy(() => import('./pages/AdminWorkspace'));

import { Database, Clock, User, Shield, Moon, Sun } from 'lucide-react';

export default function App() {
  const { isAuthenticated, isBootstrapping, user, isITSupport } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Navigation lives in the URL, not in useState. Four pieces of component state
  // meant you could not link a colleague to a ticket, could not bookmark the
  // device inventory, and lost your place on refresh — in a tool whose most
  // common interaction is "here's the ticket, take a look".
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const view: PortalView = location.pathname.startsWith('/admin') ? 'admin' : 'user';
  const adminTab = adminTabFromPath(location.pathname);
  const deviceSubTab: DeviceSubTab =
    location.pathname === '/admin/devices/reports'
      ? 'reports'
      : location.pathname === '/admin/devices/allocation'
        ? 'allocation'
        : 'management';
  const userTab: UserTab = location.pathname === '/requests/new' ? 'new' : 'requests';

  // The open ticket rides in the query string, so any page's URL can carry it:
  // /admin/tickets?ticket=42 is a shareable link straight to that ticket.
  const selectedTicketId = searchParams.get('ticket');
  const setSelectedTicketId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set('ticket', id);
          else next.delete('ticket');
          return next;
        },
        // Opening/closing a modal should not litter the back stack.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [showAdminSimulation, setShowAdminSimulation] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Bumping this forces all data-fetching children to refetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Confirmation modal shown after a ticket is created.
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  // Taxonomy from the DB — the same tables the ticket FKs point at. The bundled
  // src/data/categories.ts is only a fallback: adding a category there without
  // seeding the DB makes ticket creation fail on an FK violation.
  const [categories, setCategories] = useState<CategorySpec[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getCategories(ctrl.signal)
      .then(setCategories)
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        // Non-fatal: RequestForm falls back to the bundled static taxonomy.
        console.error('[Taxonomy] Falling back to the bundled category list:', err);
      });
    return () => ctrl.abort();
  }, []);

  // Real-time clock for the header.
  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Route guard. A requester who deep-links (or gets demoted) into /admin is sent
  // home. This is a UX guard only — every /admin API route is role-checked
  // server-side; hiding the UI has never been the control.
  useEffect(() => {
    if (view === 'admin' && !isITSupport && isAuthenticated) {
      // Do not log PII (email) to the browser console (L-1). Role is enough.
      console.warn('Security: non-privileged role on admin route, redirecting', {
        userRole: user?.role,
      });
      navigate('/requests', { replace: true });
    }
  }, [view, isITSupport, isAuthenticated, user?.role, navigate]);

  // Land somewhere real instead of a blank '/'.
  useEffect(() => {
    if (location.pathname === '/') navigate('/requests/new', { replace: true });
  }, [location.pathname, navigate]);

  // Scroll to top on navigation to prevent layout jitter. Keyed on the path, not
  // on the tab state that used to stand in for it.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleCreated = useCallback(
    (ticket: Ticket) => {
      setCreatedTicket(ticket);
      reload();
    },
    [reload],
  );

  const handleMutated = useCallback(() => {
    reload();
  }, [reload]);

  // ---- Auth gate ----------------------------------------------------------
  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <LoadingPanel message="Restoring your session…" />
      </div>
    );
  }
  if (!isAuthenticated) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex flex-col antialiased selection:bg-violet-100 selection:text-violet-950 pb-16 transition-colors overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-600 rounded-lg text-white shadow-sm ring-1 ring-violet-700/10">
                <Database className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h1 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight uppercase">
                  N-VOC SYSTEM
                </h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono">
                  Service Requests &amp; Tracking Console
                </p>
              </div>
            </div>

            {/* Clock */}
            <div className="hidden lg:flex items-center gap-5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800 py-1.5 px-3.5 rounded-md border border-slate-200/50 dark:border-slate-700">
                <Clock className="w-3.5 h-3.5 text-violet-600 animate-pulse" /> SYSTEM CLOCK: {currentTime || '…'}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Role-based view switcher (admin tab only for it_support/admin) */}
              <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <button
                  onClick={() => navigate('/requests/new')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer select-none ${
                    view === 'user'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Employee Portal</span>
                </button>
                {isITSupport && user?.role !== 'requester' && (
                  <button
                    onClick={() => navigate('/admin/tickets')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer select-none ${
                      view === 'admin'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>IT Admin Workspace</span>
                  </button>
                )}
              </div>

              {/* Quick theme toggle (also in profile menu) */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-600" />}
              </button>

              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6 flex-1 w-full animate-fade-in-smooth">
        {view === 'user' ? (
          <UserPortal
            reloadKey={reloadKey}
            tab={userTab}
            onTabChange={(t) => navigate(t === 'new' ? '/requests/new' : '/requests')}
            onCreated={handleCreated}
            onSelectTicket={(t) => setSelectedTicketId(t.id)}
            requesterEmail={user?.email ?? null}
            categories={categories}
          />
        ) : (
          <Suspense fallback={<LoadingPanel message="Loading the admin workspace…" />}>
            <AdminWorkspace
              reloadKey={reloadKey}
              adminTab={adminTab}
              onAdminTabChange={(t) => navigate(ADMIN_TAB_PATHS[t])}
              deviceSubTab={deviceSubTab}
              onDeviceSubTabChange={(s) =>
                navigate(
                  s === 'reports'
                    ? '/admin/devices/reports'
                    : s === 'allocation'
                      ? '/admin/devices/allocation'
                      : '/admin/devices',
                )
              }
              showSim={showAdminSimulation}
              onToggleSim={() => setShowAdminSimulation((s) => !s)}
              onMutated={handleMutated}
              onSelectTicket={(t) => setSelectedTicketId(t.id)}
            />
          </Suspense>
        )}
      </main>

      {/* Ticket detail (fetches its own full record) */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onMutated={handleMutated}
        />
      )}

      {/* Post-creation confirmation */}
      {createdTicket && (
        <ConfirmationModal
          ticket={createdTicket}
          onClose={() => setCreatedTicket(null)}
          onViewTicket={() => {
            setSelectedTicketId(createdTicket.id);
            setCreatedTicket(null);
          }}
        />
      )}
    </div>
  );
}

