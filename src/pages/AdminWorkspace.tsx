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
import DeviceAllocationQueue from '../components/DeviceAllocationQueue';
import DeviceReportsPage from '../components/DeviceReportsPage';
import TicketReportsPage from '../components/TicketReportsPage';
import ApprovalSettings from '../components/ApprovalSettings';
import PageHeader from '../components/shell/PageHeader';
import { Terminal } from 'lucide-react';

const DEVICE_PAGE = {
  management: {
    title: 'Device Inventory',
    subtitle: 'Every asset IT owns — PCs, laptops, servers, network gear and accessories.',
  },
  allocation: {
    title: 'Allocation Queue',
    subtitle: 'Waiting hardware requests on the left, free stock on the right. Match and issue.',
  },
  reports: {
    title: 'Asset Reports',
    subtitle: 'Stock levels, custody and lifecycle across the estate.',
  },
} as const;

export default function AdminWorkspace({
  reloadKey,
  adminTab,
  deviceSubTab,
  showSim,
  onToggleSim,
  onMutated,
  onSelectTicket,
}: {
  reloadKey: number;
  /** Driven by the route; this page never owns its own navigation state. */
  adminTab: AdminTab;
  deviceSubTab: DeviceSubTab;
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
      {/* Tickets */}
      {adminTab === 'tickets' && (
        <div className="space-y-6">
          <PageHeader
            title="Ticket Queue"
            subtitle="Manage the queue, allocate engineers, resolve tickets, and post audit logs."
            actions={
              <button
                type="button"
                onClick={onToggleSim}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                  showSim
                    ? 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                {showSim ? 'Hide dispatch console' : 'Dispatch console'}
              </button>
            }
          />

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

      {/* Devices — the sub-navigation now lives in the sidebar rail. */}
      {adminTab === 'devices' && (
        <div className="space-y-6">
          <PageHeader
            title={DEVICE_PAGE[deviceSubTab].title}
            subtitle={DEVICE_PAGE[deviceSubTab].subtitle}
          />

          {deviceSubTab === 'management' && <DeviceManagement />}

          {/* Allocation queue — waiting requests on the left, free devices on the right. */}
          {deviceSubTab === 'allocation' && <DeviceAllocationQueue onMutated={onMutated} />}

          {deviceSubTab === 'reports' && <DeviceReportsPage />}
        </div>
      )}

      {/* Request reports: pending hardware, fulfillment time, age buckets,
          category trend over time. */}
      {adminTab === 'reports' && (
        <div className="space-y-6">
          <PageHeader
            title="Reports & Trends"
            subtitle="Where the requests come from, how long they take, and what is still waiting."
          />
          <TicketReportsPage />
        </div>
      )}

      {/* Approval settings — configurable default flow + leader resolution. */}
      {adminTab === 'approval' && (
        <div className="space-y-6">
          <PageHeader
            title="Approval"
            subtitle="Which requests need a leader's sign-off, and who that leader is."
          />
          <ApprovalSettings />
        </div>
      )}
    </div>
  );
}
