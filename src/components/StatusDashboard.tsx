// ============================================================================
// StatusDashboard — Cyber-Ops style admin dashboard for the current ticket set.
// Presentational: KPI counts come from the server's SQL aggregate (`stats`), the
// priority queue and category breakdown from the loaded page. Layout follows the
// stitch admin dashboard: KPI strip -> priority queue + insight panel -> categories.
// ============================================================================

import { useMemo } from 'react';
import { isOpenStatus } from '../types';
import type { Ticket, TicketStatus, TicketPriority } from '../types';
import type { TicketStatsSummary } from '../api/client';
import { IT_CATEGORIES } from '../data/categories';
import { Activity, AlertTriangle, CheckCircle2, Clock, Inbox, TrendingUp, Flame } from 'lucide-react';

interface StatusDashboardProps {
  tickets: Ticket[];
  total?: number; // server-reported total (may exceed loaded page)
  /** SQL-aggregated counts over the whole table; preferred over deriving from `tickets`. */
  stats?: TicketStatsSummary | null;
  onSelectTicket?: (t: Ticket) => void;
}

const STATUS_META: Record<TicketStatus, { label: string; dot: string; text: string }> = {
  submitted: { label: 'Submitted', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  pending_approval: {
    label: 'Awaiting Approval',
    dot: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  waiting: { label: 'Waiting for Review', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  resolved: { label: 'Resolved', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

const PRIORITY_META: Record<TicketPriority, { label: string; cls: string; badge: string }> = {
  urgent: {
    label: 'Urgent',
    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  },
  high: {
    label: 'High',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  },
  medium: {
    label: 'Medium',
    cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  },
  low: {
    label: 'Low',
    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    badge: 'bg-slate-400/15 text-slate-500 dark:text-slate-300 border-slate-400/30',
  },
};

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function StatusDashboard({ tickets, total, stats, onSelectTicket }: StatusDashboardProps) {
  const metrics = useMemo(() => {
    // Counts come from the server's SQL aggregate when available. Deriving them
    // from `tickets` only sees one capped page, so the breakdowns silently
    // under-report once the table grows past that page size. `stats.categories`
    // is keyed by categories.id, which is the same VARCHAR code as Ticket.category.
    const rank = (counts: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (stats) {
      const s = stats.summary;
      // No `as Record<...>` cast here: the cast is what let this object silently
      // omit a status when the union grew. Let the compiler enforce exhaustiveness.
      const byStatus: Record<TicketStatus, number> = {
        submitted: s.submitted,
        pending_approval: s.pendingApproval,
        waiting: s.waiting,
        resolved: s.resolved,
        rejected: s.rejected,
      };
      return {
        byStatus,
        byPriority: stats.priorities,
        open: s.pending,
        closed: s.resolved + s.rejected,
        resolutionRate: s.resolutionRate,
        topCategories: rank(stats.categories),
      };
    }

    // Fallback while the stats request is in flight or has failed.
    const byStatus: Record<TicketStatus, number> = {
      submitted: 0,
      pending_approval: 0,
      waiting: 0,
      resolved: 0,
      rejected: 0,
    };
    const byPriority: Record<TicketPriority, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    const byCategory: Record<string, number> = {};
    for (const t of tickets) {
      byStatus[t.status]++;
      byPriority[t.priority]++;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }

    const open = byStatus.submitted + byStatus.pending_approval + byStatus.waiting;
    const closed = byStatus.resolved + byStatus.rejected;
    const resolutionRate = tickets.length ? Math.round((byStatus.resolved / tickets.length) * 100) : 0;

    return { byStatus, byPriority, open, closed, resolutionRate, topCategories: rank(byCategory) };
  }, [tickets, stats]);

  // Priority queue — open tickets, highest priority first (stitch "Critical Incidents").
  const priorityQueue = useMemo(
    () =>
      [...tickets]
        .filter((t) => isOpenStatus(t.status))
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
        )
        .slice(0, 6),
    [tickets],
  );

  const headlineTotal = total ?? tickets.length;
  const categoryName = (id: string) => IT_CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const cards = [
    { label: 'Total VOCs', value: headlineTotal, icon: Inbox, accent: 'border-t-slate-400', valueCls: 'text-slate-950 dark:text-white' },
    { label: 'Open / Active', value: metrics.open, icon: Activity, accent: 'border-t-violet-600', valueCls: 'text-violet-700 dark:text-violet-300' },
    { label: 'Waiting for Review', value: metrics.byStatus.waiting, icon: Clock, accent: 'border-t-amber-500', valueCls: 'text-amber-600 dark:text-amber-400' },
    { label: 'Resolved', value: metrics.byStatus.resolved, icon: CheckCircle2, accent: 'border-t-emerald-500', valueCls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Resolution Rate', value: `${metrics.resolutionRate}%`, icon: TrendingUp, accent: 'border-t-violet-500', valueCls: 'text-violet-700 dark:text-violet-300' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 border-t-[3px] ${c.accent} shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                  {c.label}
                </span>
                <Icon className="w-4 h-4 text-slate-300 dark:text-slate-600" />
              </div>
              <span className={`text-3xl font-extrabold font-sans tracking-tight mt-2 ${c.valueCls}`}>
                {c.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main: priority queue table (2/3) + insight side panel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Priority queue */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-500" /> Priority Queue · Open
            </h4>
            <span className="text-[10px] font-mono font-bold text-slate-400">{priorityQueue.length} shown</span>
          </div>
          {priorityQueue.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-400 italic">No open tickets in the queue.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {/* header row */}
              <div className="hidden sm:grid grid-cols-[100px_1fr_90px_120px] gap-3 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                <span>Code</span><span>Summary</span><span>Priority</span><span>Status</span>
              </div>
              {priorityQueue.map((t) => {
                const pm = PRIORITY_META[t.priority];
                const sm = STATUS_META[t.status];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTicket?.(t)}
                    disabled={!onSelectTicket}
                    className="w-full text-left grid grid-cols-[100px_1fr] sm:grid-cols-[100px_1fr_90px_120px] gap-3 px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-default"
                  >
                    <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded w-fit">
                      {t.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {t.title}
                    </span>
                    <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${pm.badge}`}>
                      {pm.label}
                    </span>
                    <span className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold ${sm.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} /> {sm.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Insight side panel: status distribution + priority mix */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
            <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono mb-3.5">
              Status Distribution
            </h4>
            <div className="space-y-2.5">
              {(Object.keys(STATUS_META) as TicketStatus[]).map((s) => {
                const count = metrics.byStatus[s];
                const pct = tickets.length ? (count / tickets.length) * 100 : 0;
                const meta = STATUS_META[s];
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label}
                      </span>
                      <span className={`font-mono font-bold ${meta.text}`}>{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full ${meta.dot} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
            <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono mb-3.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Priority Mix
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                <div key={p} className={`rounded-lg px-3 py-2.5 ${PRIORITY_META[p].cls} flex items-center justify-between`}>
                  <span className="text-[11px] font-bold">{PRIORITY_META[p].label}</span>
                  <span className="text-sm font-extrabold font-mono">{metrics.byPriority[p]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category breakdown — full width */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
        <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono mb-3.5">
          Top Categories
        </h4>
        {metrics.topCategories.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No data yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {metrics.topCategories.map(([catId, count]) => {
              const max = metrics.topCategories[0][1] || 1;
              const pct = (count / max) * 100;
              return (
                <div key={catId}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate pr-2">
                      {categoryName(catId)}
                    </span>
                    <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
