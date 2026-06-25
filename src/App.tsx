// ============================================================================
// App — top-level orchestration.
// - Gates the whole UI behind authentication (Login until a session exists).
// - Owns a `reloadKey` counter: any successful mutation (create/update/comment)
//   bumps it, and every data-fetching child refetches on [params, reloadKey].
//   This keeps the server as the single source of truth without prop-drilling
//   ticket arrays or mutation handlers through the tree.
// - Role-gates the IT Admin workspace on it_support/admin.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import type { Ticket } from './types';
import { api, ApiError } from './api/client';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';

import Login from './components/Login';
import UserProfile from './components/UserProfile';
import RequestForm from './components/RequestForm';
import TicketList from './components/TicketList';
import TicketDetailModal from './components/TicketDetailModal';
import AdminSimulation from './components/AdminSimulation';
import StatusDashboard from './components/StatusDashboard';
import ConfirmationModal from './components/ConfirmationModal';
import DeviceManagement from './components/DeviceManagement';
import DeviceReportsPage from './components/DeviceReportsPage';
import { LoadingPanel, ErrorState } from './components/ui/Spinner';

import {
  Database,
  Clock,
  User,
  Shield,
  Terminal,
  MessageSquare,
  AlertCircle,
  Moon,
  Sun,
  Cpu,
} from 'lucide-react';

type PortalView = 'user' | 'admin';

// Pull a wide page for dashboard metrics so breakdowns reflect the whole set,
// not just the paginated list page. (No dedicated stats endpoint exists.)
// Max allowed by backend is 100.
const METRICS_PAGE_SIZE = 100;

export default function App() {
  const { isAuthenticated, isBootstrapping, user, isITSupport } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [view, setView] = useState<PortalView>('user');
  const [adminTab, setAdminTab] = useState<'tickets' | 'devices'>('tickets');
  const [deviceSubTab, setDeviceSubTab] = useState<'management' | 'reports'>('management');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showAdminSimulation, setShowAdminSimulation] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Bumping this forces all data-fetching children to refetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Confirmation modal shown after a ticket is created.
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

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

  // If a requester is somehow on the admin view (e.g. role changed), snap back.
  useEffect(() => {
    if (view === 'admin' && !isITSupport) {
      console.warn('Security: Requester attempted admin view, redirecting to user portal', {
        userEmail: user?.email,
        userRole: user?.role,
      });
      setView('user');
    }
  }, [view, isITSupport, user?.role]);

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
                  onClick={() => setView('user')}
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
                    onClick={() => setView('admin')}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6 flex-1 w-full animate-fadeIn">
        {view === 'user' ? (
          <UserPortal
            reloadKey={reloadKey}
            onCreated={handleCreated}
            onSelectTicket={(t) => setSelectedTicketId(t.id)}
            requesterEmail={user?.email ?? null}
          />
        ) : (
          <AdminWorkspace
            reloadKey={reloadKey}
            adminTab={adminTab}
            onAdminTabChange={setAdminTab}
            deviceSubTab={deviceSubTab}
            onDeviceSubTabChange={setDeviceSubTab}
            showSim={showAdminSimulation}
            onToggleSim={() => setShowAdminSimulation((s) => !s)}
            onMutated={handleMutated}
            onSelectTicket={(t) => setSelectedTicketId(t.id)}
          />
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

// ---------------------------------------------------------------------------
// User portal: request form + the requester's own ticket list.
// ---------------------------------------------------------------------------
function UserPortal({
  reloadKey,
  onCreated,
  onSelectTicket,
  requesterEmail,
}: {
  reloadKey: number;
  onCreated: (t: Ticket) => void;
  onSelectTicket: (t: Ticket) => void;
  requesterEmail: string | null;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    // A requester sees the full queue (backend has no per-requester filter);
    // we surface a reasonable page newest-first. `q` search is in TicketList for admins.
    api
      .listTickets({ page: 1, pageSize: 50, sort: 'newest' }, ctrl.signal)
      .then((res) => setTickets(res.data))
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Could not load your requests.');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [reloadKey]);

  // Highlight the current user's own tickets if we can match by email.
  const mine = requesterEmail
    ? tickets.filter((t) => t.requesterEmail?.toLowerCase() === requesterEmail.toLowerCase())
    : [];

  const getStatusBadge = (st: string) => {
    if (st === 'submitted') return 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    if (st === 'waiting') return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    if (st === 'resolved') return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  };
  const getStatusText = (st: string) =>
    st === 'submitted' ? 'Submitted'
    : st === 'waiting' ? 'Waiting for Review'
    : st === 'resolved' ? 'Resolved'
    : 'Rejected';

  const listToShow = mine.length > 0 ? mine : tickets;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 space-y-6">
        <RequestForm onCreated={onCreated} />
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.015)] p-6 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
                Your VOC Requests
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                Track current status or discuss with IT
              </p>
            </div>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-300">
              {listToShow.length} VOCs
            </span>
          </div>

          {loading ? (
            <LoadingPanel message="Loading your requests…" />
          ) : error ? (
            <ErrorState message={error} />
          ) : listToShow.length === 0 ? (
            <div className="py-16 px-4 text-center text-slate-400 flex flex-col items-center justify-center gap-2.5">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No requests filed yet</p>
              <p className="text-[10px] text-slate-400 leading-tight max-w-xs mx-auto">
                Fill in the fields and click "Submit Request" on the left to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {listToShow.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className="p-3.5 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/30 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 rounded-lg transition-all cursor-pointer group flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                      {ticket.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(ticket.status)}`}>
                      {getStatusText(ticket.status)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-violet-600 transition-colors">
                      {ticket.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-normal italic">
                      "{ticket.description}"
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-2 text-[10px] text-slate-400 font-medium font-mono">
                    <span>IT: {ticket.assignedTo || 'Unassigned'}</span>
                    <div className="flex items-center gap-1 text-violet-600 font-sans font-semibold">
                      <MessageSquare className="w-3.5 h-3.5" /> Details &amp; Chat
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin workspace: dashboard metrics, dispatch console, full queue, device inventory.
// ---------------------------------------------------------------------------
function AdminWorkspace({
  reloadKey,
  adminTab,
  onAdminTabChange,
  deviceSubTab,
  onDeviceSubTabChange,
  showSim,
  onToggleSim,
  onMutated,
  onSelectTicket,
}: {
  reloadKey: number;
  adminTab: 'tickets' | 'devices';
  onAdminTabChange: (tab: 'tickets' | 'devices') => void;
  deviceSubTab: 'management' | 'reports';
  onDeviceSubTabChange: (tab: 'management' | 'reports') => void;
  showSim: boolean;
  onToggleSim: () => void;
  onMutated: () => void;
  onSelectTicket: (t: Ticket) => void;
}) {
  // Wide fetch purely for dashboard + dispatch console (whole-set metrics).
  const [metricsTickets, setMetricsTickets] = useState<Ticket[]>([]);
  const [metricsTotal, setMetricsTotal] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .listTickets({ page: 1, pageSize: METRICS_PAGE_SIZE, sort: 'newest' }, ctrl.signal)
      .then((res) => {

        setMetricsTickets(res.data);
        setMetricsTotal(res.total);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        console.error('[Dashboard] Failed to load tickets:', err);
        // Non-fatal: the dashboard simply shows zeros if this fails.
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      {/* Admin Tab Switcher */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onAdminTabChange('tickets')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            adminTab === 'tickets'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Ticket Queue
        </button>
        <button
          onClick={() => onAdminTabChange('devices')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            adminTab === 'devices'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Device Inventory
        </button>
      </div>

      {/* Tickets Tab Content */}
      {adminTab === 'tickets' && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="bg-slate-900 dark:bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-7 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 tracking-tight flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-500" />
                Operator Dispatch Console (IT Support Admin)
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed">
                Manage the queue, allocate engineers, resolve tickets, and post official technical audit logs.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSim}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                showSim
                  ? 'bg-amber-500/25 border-amber-500/40 text-amber-400 hover:bg-amber-500/35'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              {showSim ? 'Minimize Console' : 'Expand Console'}
            </button>
          </div>

          {/* Unified Dashboard: metrics + breakdowns */}
          <StatusDashboard tickets={metricsTickets} total={metricsTotal} />

          {/* Dispatch console */}
          {showSim && (
            <AdminSimulation tickets={metricsTickets} onMutated={onMutated} />
          )}

          {/* Master queue: server-side search / filter / sort / pagination */}
          <TicketList reloadKey={reloadKey} onSelectTicket={onSelectTicket} />
        </div>
      )}

      {/* Devices Tab Content */}
      {adminTab === 'devices' && (
        <div className="space-y-6">
          {/* Sub-tabs for device management */}
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onDeviceSubTabChange('management')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                deviceSubTab === 'management'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Device Management
            </button>
            <button
              onClick={() => onDeviceSubTabChange('reports')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                deviceSubTab === 'reports'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Reports & Analytics
            </button>
          </div>

          {/* Device Management */}
          {deviceSubTab === 'management' && (
            <DeviceManagement user={{ role: 'admin' }} />
          )}

          {/* Device Reports */}
          {deviceSubTab === 'reports' && (
            <DeviceReportsPage />
          )}
        </div>
      )}
    </div>
  );
}
