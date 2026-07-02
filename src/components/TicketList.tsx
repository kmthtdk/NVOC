// ============================================================================
// TicketList — server-driven master queue, styled as a Cyber-Ops "Priority
// Stream". All search / filter / sort / pagination is delegated to the backend
// via api.listTickets; the component holds only the query params and the current
// page payload. Refetches whenever params OR the parent `reloadKey` changes,
// so mutations elsewhere (create/update/comment) keep this list fresh.
//
// Layout only: each ticket renders as a rich card-row with a priority accent
// bar + badge, code + title, description snippet, category/subcategory chips,
// assignee, and a relative timestamp. Data flow and handlers are unchanged.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '../types';
import { IT_CATEGORIES } from '../data/categories';
import { api, ApiError, type ListTicketsParams } from '../api/client';
import { LoadingPanel, ErrorState } from './ui/Spinner';
import {
  Search,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertOctagon,
  AlertTriangle,
  Info,
  Minus,
  Clock,
  type LucideIcon,
} from 'lucide-react';

interface TicketListProps {
  reloadKey: number;
  onSelectTicket: (ticket: Ticket) => void;
}

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

// Flat id -> display-name lookups (built once from the category spec).
const CATEGORY_NAMES: Record<string, string> = {};
const SUBCATEGORY_NAMES: Record<string, string> = {};
for (const cat of IT_CATEGORIES) {
  CATEGORY_NAMES[cat.id] = cat.name;
  for (const sub of cat.subcategories) SUBCATEGORY_NAMES[sub.id] = sub.name;
}

const STATUS_BADGE: Record<TicketStatus, { cls: string; label: string }> = {
  submitted: { cls: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800', label: 'Submitted' },
  waiting: { cls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800', label: 'Waiting for Review' },
  resolved: { cls: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800', label: 'Resolved' },
  rejected: { cls: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800', label: 'Rejected' },
};

// Priority → visual language (mock's P1/P2/P3 + a muted P4 for `low`).
// urgent = rose (P1) · high = amber (P2) · medium = sky/teal (P3) · low = muted (P4).
interface PriorityMeta {
  code: string;
  label: string;
  accent: string; // left accent bar color
  Icon: LucideIcon;
  iconCls: string;
  badgeCls: string;
}
const PRIORITY_META: Record<TicketPriority, PriorityMeta> = {
  urgent: {
    code: 'P1',
    label: 'Urgent',
    accent: 'border-l-rose-500 dark:border-l-rose-500',
    Icon: AlertOctagon,
    iconCls: 'text-rose-600 dark:text-rose-400',
    badgeCls: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  high: {
    code: 'P2',
    label: 'High',
    accent: 'border-l-amber-500 dark:border-l-amber-500',
    Icon: AlertTriangle,
    iconCls: 'text-amber-600 dark:text-amber-400',
    badgeCls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  medium: {
    code: 'P3',
    label: 'Medium',
    accent: 'border-l-sky-500 dark:border-l-sky-500',
    Icon: Info,
    iconCls: 'text-sky-600 dark:text-sky-400',
    badgeCls: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  low: {
    code: 'P4',
    label: 'Low',
    accent: 'border-l-slate-300 dark:border-l-slate-600',
    Icon: Minus,
    iconCls: 'text-slate-500 dark:text-slate-400',
    badgeCls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}

// Compact relative timestamp ("14m ago", "2h ago", "3d ago"). Pure — computed
// once per render from the ticket's createdAt.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Two-letter avatar seed from an assignee / name string.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
    {children}
  </span>
);

// One priority-stream row.
function TicketRow({ ticket, onSelect }: { ticket: Ticket; onSelect: () => void }) {
  const meta = PRIORITY_META[ticket.priority];
  const Icon = meta.Icon;
  const categoryName = CATEGORY_NAMES[ticket.category] ?? ticket.category;
  const subName = SUBCATEGORY_NAMES[ticket.subcategory] ?? ticket.subcategory;
  const assignee = ticket.assignedTo?.trim() || 'Unassigned';
  const hasAssignee = assignee !== 'Unassigned';

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      className={`group flex gap-3 sm:gap-4 p-4 border-l-4 ${meta.accent} hover:bg-slate-50/70 dark:hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 transition-colors cursor-pointer`}
    >
      {/* Priority indicator column */}
      <div className="flex flex-col items-center gap-1 w-9 sm:w-11 shrink-0 pt-0.5">
        <Icon className={`w-5 h-5 ${meta.iconCls}`} />
        <span className={`font-mono text-[11px] font-bold ${meta.iconCls}`}>{meta.code}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Top line: code + status + title / time-ago */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100">{ticket.code}</span>
              <StatusBadge status={ticket.status} />
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${meta.badgeCls}`}>
                {meta.label}
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1 leading-snug">
              {ticket.title}
            </h4>
          </div>
          <span className="shrink-0 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {timeAgo(ticket.createdAt)}
          </span>
        </div>

        {/* Description snippet */}
        {ticket.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 mb-2 leading-relaxed">
            {ticket.description}
          </p>
        )}

        {/* Chips + assignee */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{categoryName}</Chip>
          {subName && subName !== categoryName && <Chip>{subName}</Chip>}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="hidden sm:inline text-[11px] font-medium text-slate-500 dark:text-slate-400">
              IT: <span className="text-slate-700 dark:text-slate-200">{assignee}</span>
            </span>
            <span
              title={`Assigned to ${assignee}`}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                hasAssignee
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              {hasAssignee ? initials(assignee) : '?'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TicketList({ reloadKey, onSelectTicket }: TicketListProps) {
  // Raw search input vs. the debounced value actually sent to the server.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Any filter/search/sort change resets to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, priorityFilter, sort]);

  const params = useMemo<ListTicketsParams>(() => {
    const p: ListTicketsParams = { page, pageSize: PAGE_SIZE, sort };
    if (debouncedSearch) p.q = debouncedSearch;
    if (statusFilter !== 'all') p.status = statusFilter;
    if (categoryFilter !== 'all') p.category = categoryFilter;
    if (priorityFilter !== 'all') p.priority = priorityFilter;
    return p;
  }, [page, sort, debouncedSearch, statusFilter, categoryFilter, priorityFilter]);

  // Track the latest request to ignore out-of-order responses.
  const reqId = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    api
      .listTickets(params, ctrl.signal)
      .then((res) => {
        if (myReq !== reqId.current) return;
        setData(res.data);
        setTotal(res.total);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError' || myReq !== reqId.current) return;
        setError(err instanceof ApiError ? err.message : 'Could not load tickets.');
      })
      .finally(() => {
        if (myReq === reqId.current) setLoading(false);
      });
    return () => ctrl.abort();
  }, [params, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setSort('newest');
  };

  const inputCls =
    'text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-violet-600 cursor-pointer';

  return (
    <div className="space-y-4">
      {/* Priority-stream header — mirrors the mock's queue header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Priority Stream</h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span className="font-medium">Live feed active</span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="font-mono">{total} {total === 1 ? 'ticket' : 'tickets'} in queue</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-all"
          title="Toggle sort order"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {/* Filter + search bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search tickets"
              placeholder="Search by code, name, title or context…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:w-auto">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
              className={inputCls}
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="waiting">Waiting for Review</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputCls}
            >
              <option value="all">All Groups</option>
              {IT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
              className={inputCls}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Priority-stream list / states */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Stream sub-header with a priority legend */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Priority Key
          </h4>
          <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> P1
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> P2
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> P3
            </span>
            <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> P4
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingPanel message="Loading tickets…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setPage((p) => p)} />
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <h5 className="font-semibold text-sm text-slate-700 dark:text-slate-300">No matching tickets</h5>
            <p className="text-xs text-slate-400">Adjust your search or filters.</p>
            <button onClick={resetFilters} className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 cursor-pointer">
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Card-row stream */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} onSelect={() => onSelectTicket(ticket)} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
