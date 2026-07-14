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
import { adminTabFromPath } from './navigation';

import Login from './components/Login';
import UserProfile from './components/UserProfile';
import TicketDetailModal from './components/TicketDetailModal';
import ConfirmationModal from './components/ConfirmationModal';
import { LoadingPanel } from './components/ui/Spinner';
import Sidebar from './components/shell/Sidebar';
import CommandBar from './components/shell/CommandBar';
import UserPortal from './pages/UserPortal';

// The admin workspace pulls in the device inventory, the pivot table and both
// report pages. A requester filing a ticket never opens any of it, so it is
// split out of the initial bundle instead of shipped to everyone.
const AdminWorkspace = lazy(() => import('./pages/AdminWorkspace'));

import { Database, Clock, Menu, Moon, Sun } from 'lucide-react';

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
  // Below `lg` the navigation rail is a drawer. Stable callback: Sidebar keys an
  // effect off it.
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

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
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans antialiased selection:bg-violet-100 selection:text-violet-950 transition-colors">
      {/* Top bar. Thin, full width, and the home of the global search — the
          reference puts the command bar here and nothing else competes with it.
          Translucent + 12px backdrop blur per the spec: the fixed nav keeps a
          sense of context while you scroll long data streams instead of sitting
          on top of them as an opaque slab. `supports-[backdrop-filter]` keeps it
          fully opaque where blur is unavailable, so text never lands on an
          unreadable see-through white. */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)] backdrop-blur-[12px] supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900 dark:supports-[backdrop-filter]:bg-slate-900/80">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
          {/* Below lg the rail is a drawer, so navigation needs a way in. */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex shrink-0 items-center gap-3 lg:w-56">
            <div className="rounded-lg bg-violet-700 p-2 text-white shadow-sm ring-1 ring-violet-800/10">
              <Database className="h-5 w-5 stroke-[2]" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-[15px] font-extrabold uppercase leading-tight tracking-tight text-slate-900 dark:text-white">
                N-VOC System
              </h1>
              <p className="truncate font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">
                IT Service Management
              </p>
            </div>
          </div>

          {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
              without it the search trigger refuses to shrink below its text and
              shoves the avatar and theme toggle off the right edge of a phone. */}
          <div className="flex min-w-0 flex-1 justify-center">
            <CommandBar
              canSeeDevices={isITSupport}
              ticketBasePath={view === 'admin' ? '/admin/tickets' : '/requests'}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 rounded-md border border-slate-200/50 bg-slate-100/80 px-3 py-1.5 font-mono text-[11px] font-semibold text-slate-600 xl:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Clock className="h-3.5 w-3.5 text-violet-600" /> {currentTime || '…'}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-violet-600" />
              )}
            </button>
            <UserProfile />
          </div>
        </div>
      </header>

      <div className="flex">
        <Sidebar
          isAdminView={view === 'admin'}
          isITSupport={isITSupport && user?.role !== 'requester'}
          onSwitchView={(to) => navigate(to === 'admin' ? '/admin/tickets' : '/requests/new')}
          mobileOpen={navOpen}
          onCloseMobile={closeNav}
        />

        <main className="animate-fade-in-smooth min-w-0 flex-1 space-y-6 px-4 py-6 pb-16 sm:px-6 lg:px-8">
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
              deviceSubTab={deviceSubTab}
              showSim={showAdminSimulation}
              onToggleSim={() => setShowAdminSimulation((s) => !s)}
              onMutated={handleMutated}
              onSelectTicket={(t) => setSelectedTicketId(t.id)}
            />
          </Suspense>
        )}
        </main>
      </div>

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

