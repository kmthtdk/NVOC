'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Clock, CheckCircle2, Activity, TrendingUp } from 'lucide-react';
import { getAuthToken } from '../api/client';
import { IT_CATEGORIES } from '../data/categories';

interface DashboardStats {
  summary: {
    total: number;
    submitted: number;
    waiting: number;
    resolved: number;
    rejected: number;
    pending: number;
    resolutionRate: number;
  };
  categories: Record<string, number>;
  priorities: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

interface RecentStats {
  recent_submitted: any[];
  recent_resolved: any[];
  unassigned_pending: any[];
}

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  submitted: { label: 'Submitted', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  waiting: { label: 'Waiting for Review', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  resolved: { label: 'Resolved', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  high: { label: 'High', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  medium: { label: 'Medium', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [statsRes, recentRes] = await Promise.all([
          fetch('/api/tickets/stats/summary', { headers, credentials: 'include' }),
          fetch('/api/tickets/stats/recent', { headers, credentials: 'include' }),
        ]);

        const statsData = statsRes.ok ? await statsRes.json() : null;
        const recentData = recentRes.ok ? await recentRes.json() : null;

        setStats(statsData);
        setRecent(recentData);

        if (!statsData && !recentData) {
          setError('Unable to load dashboard data. Please refresh the page.');
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const categoryName = (id: string) => IT_CATEGORIES.find((c) => c.id === id)?.name ?? id;

  const metrics = useMemo(() => {
    if (!stats) return null;
    const total = stats.summary.total || 0;
    const open = stats.summary.submitted + stats.summary.waiting;
    const topCategories = Object.entries(stats.categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { open, topCategories, total };
  }, [stats]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || !metrics) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 flex gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-300">No Data Available</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">Dashboard data could not be retrieved. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Requests',
      value: metrics.total,
      icon: AlertTriangle,
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
      value: stats.summary.waiting,
      icon: Clock,
      accent: 'border-l-amber-500',
      iconCls: 'text-amber-500',
    },
    {
      label: 'Resolved',
      value: stats.summary.resolved,
      icon: CheckCircle2,
      accent: 'border-l-emerald-500',
      iconCls: 'text-emerald-500',
    },
    {
      label: 'Resolution Rate',
      value: `${stats.summary.resolutionRate}%`,
      icon: TrendingUp,
      accent: 'border-l-sky-500',
      iconCls: 'text-sky-500',
    },
  ];

  const statusEntries = Object.entries(STATUS_META);
  const priorityEntries = Object.entries(PRIORITY_META);

  return (
    <div className="space-y-4">
      {/* Metric cards */}
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
            {statusEntries.map(([status, meta]) => {
              const count = stats.summary[status as keyof typeof stats.summary] as number || 0;
              const pct = stats.summary.total ? (count / stats.summary.total) * 100 : 0;
              return (
                <div key={status}>
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
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Priority Distribution
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            {priorityEntries.map(([priority, meta]) => (
              <div
                key={priority}
                className={`rounded-lg px-3 py-2.5 ${meta.cls} flex items-center justify-between`}
              >
                <span className="text-[11px] font-bold">{meta.label}</span>
                <span className="text-sm font-extrabold font-mono">{stats.priorities[priority as keyof typeof stats.priorities] || 0}</span>
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
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No data yet.</p>
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

      {/* Unassigned alert */}
      {recent && recent.unassigned_pending && recent.unassigned_pending.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {recent.unassigned_pending.length} Unassigned Pending Request{recent.unassigned_pending.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-sm text-red-800 dark:text-red-400 mt-1">These requests require immediate attention</p>
        </div>
      )}
    </div>
  );
}
