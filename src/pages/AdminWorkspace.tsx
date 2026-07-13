// AdminWorkspace — IT's side: ticket queue, device inventory, reports, approvals.
// Extracted from App.tsx when routing moved into the URL; App is now a shell.

import { useEffect, useState } from 'react';
import type { Ticket } from '../types';
import { api } from '../api/client';
import type { TicketStatsSummary } from '../api/client';
import type { AdminTab, DeviceSubTab } from '../navigation';
import { METRICS_PAGE_SIZE } from '../navigation';
import TicketList from '../components/TicketList';
import AdminSimulation from '../components/AdminSimulation';
import StatusDashboard from '../components/StatusDashboard';
import DeviceManagement from '../components/DeviceManagement';
import DeviceReportsPage from '../components/DeviceReportsPage';
import TicketReportsPage from '../components/TicketReportsPage';
import ApprovalSettings from '../components/ApprovalSettings';
import { BarChart3, Cpu, Shield, Terminal } from 'lucide-react';

export default function AdminWorkspace({
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
  /** Driven by the route; this page never owns its own navigation state. */
  adminTab: AdminTab;
  onAdminTabChange: (tab: AdminTab) => void;
  deviceSubTab: DeviceSubTab;
  onDeviceSubTabChange: (tab: DeviceSubTab) => void;
  showSim: boolean;
  onToggleSim: () => void;
  onMutated: () => void;
  onSelectTicket: (t: Ticket) => void;
}) {
  // Ticket rows for the dispatch console and the dashboard's priority queue.
  const [metricsTickets, setMetricsTickets] = useState<Ticket[]>([]);
  const [metricsTotal, setMetricsTotal] = useState(0);
  // Whole-table counts, aggregated in SQL. The KPI numbers must not be derived
  // from the capped page above, or they under-report past METRICS_PAGE_SIZE.
  const [stats, setStats] = useState<TicketStatsSummary | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const ignoreAbort = (err: unknown) => {
      if ((err as Error)?.name === 'AbortError') return;
      console.error('[Dashboard] Failed to load metrics:', err);
      // Non-fatal: the dashboard falls back to page-derived counts.
    };

    api
      .listTickets({ page: 1, pageSize: METRICS_PAGE_SIZE, sort: 'newest' }, ctrl.signal)
      .then((res) => {
        setMetricsTickets(res.data);
        setMetricsTotal(res.total);
      })
      .catch(ignoreAbort);

    api
      .getStatsSummary('all', ctrl.signal)
      .then(setStats)
      .catch(ignoreAbort);

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
        <button
          onClick={() => onAdminTabChange('reports')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            adminTab === 'reports'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Reports &amp; Trends
        </button>
        <button
          onClick={() => onAdminTabChange('approval')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            adminTab === 'approval'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          Approval
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
          <StatusDashboard
            tickets={metricsTickets}
            total={metricsTotal}
            stats={stats}
            onSelectTicket={onSelectTicket}
          />

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
            <DeviceManagement />
          )}

          {/* Device Reports */}
          {deviceSubTab === 'reports' && (
            <DeviceReportsPage />
          )}
        </div>
      )}

      {/* Reports & Trends Tab Content — request reports: pending hardware,
          fulfillment time, age buckets, and category trend over time. */}
      {adminTab === 'reports' && <TicketReportsPage />}

      {/* Approval settings — configurable default flow + leader resolution. */}
      {adminTab === 'approval' && <ApprovalSettings />}
    </div>
  );
}
