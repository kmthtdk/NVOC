// ============================================================================
// StatusDashboard — at-a-glance metrics for the current ticket set.
// Pure presentational: it derives counts from the tickets passed in. Used at the
// top of the admin workspace and reused for the simple user summary.
// ============================================================================

import React, { useMemo } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '../types';
import { IT_CATEGORIES } from '../data/categories';
import { Activity, AlertTriangle, CheckCircle2, Clock, Inbox, TrendingUp } from 'lucide-react';

interface StatusDashboardProps {
  tickets: Ticket[];
  total?: number; // server-reported total (may exceed loaded page)
}

const STATUS_META: Record<TicketStatus, { label: string; dot: string; text: string }> = {
  submitted: { label: 'Submitted', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  waiting: { label: 'Waiting for Review', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  resolved: { label: 'Resolved', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

const PRIORITY_META: Record<TicketPriority, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  high: { label: 'High', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  medium: { label: 'Medium', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export default function StatusDashboard({ tickets, total }: StatusDashboardProps) {
  const metrics = useMemo(() => {
    const byStatus: Record<TicketStatus, number> = {
      submitted: 0,
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

    const open = byStatus.submitted + byStatus.waiting;
    const closed = byStatus.resolved + byStatus.rejected;
    const resolutionRate = tickets.length ? Math.round((byStatus.resolved / tickets.length) * 100) : 0;

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { byStatus, byPriority, open, closed, resolutionRate, topCategories };
  }, [tickets]);

  const headlineTotal = total ?? tickets.length;
  const categoryName = (id: string) => IT_CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const cards = [
    {
      label: 'Total VOCs',
      value: headlineTotal,
      icon: Inbox,
      accent: 'border-l-slate-400',
      iconCls: 'text-slate-400',
    },
    {
      label: 'Open / Active',
      value: metrics.open,
      icon: Activity,
      accent: 'border-l-violet-600',
      iconCls: 'text-violet-600',
    },
    {
      label: 'Waiting for Review',
      value: metrics.byStatus.waiting,
      icon: Clock,
      accent: 'border-l-amber-500',
      iconCls: 'text-amber-500',
    },
    {
      label: 'Resolved',
      value: metrics.byStatus.resolved,
      icon: CheckCircle2,
      accent: 'border-l-emerald-500',
      iconCls: 'text-emerald-500',
    },
    {
      label: 'Resolution Rate',
      value: `${metrics.resolutionRate}%`,
      icon: TrendingUp,
      accent: 'border-l-sky-500',
      iconCls: 'text-sky-500',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Headline counters */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 border-l-[4px] ${c.accent} shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                  {c.label}
                </span>
                <Icon className={`w-4 h-4 ${c.iconCls}`} />
              </div>
              <span className="text-2xl font-extrabold text-slate-950 dark:text-white font-sans tracking-tight mt-2">
                {c.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status distribution */}
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

        {/* Priority mix */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono mb-3.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Priority Mix
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
              <div
                key={p}
                className={`rounded-lg px-3 py-2.5 ${PRIORITY_META[p].cls} flex items-center justify-between`}
              >
                <span className="text-[11px] font-bold">{PRIORITY_META[p].label}</span>
                <span className="text-sm font-extrabold font-mono">{metrics.byPriority[p]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top categories */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
          <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono mb-3.5">
            Top Categories
          </h4>
          {metrics.topCategories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No data yet.</p>
          ) : (
            <div className="space-y-2.5">
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
    </div>
  );
}
