// ============================================================================
// TicketList — server-driven master queue.
// All search / filter / sort / pagination is delegated to the backend via
// api.listTickets; the component holds only the query params and the current
// page payload. Refetches whenever params OR the parent `reloadKey` changes,
// so mutations elsewhere (create/update/comment) keep this list fresh.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '../types';
import { IT_CATEGORIES } from '../data/categories';
import { api, ApiError, type ListTicketsParams } from '../api/client';
import { LoadingPanel, ErrorState } from './ui/Spinner';
import {
  Search,
  User,
  ClipboardList,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

interface TicketListProps {
  reloadKey: number;
  onSelectTicket: (ticket: Ticket) => void;
}

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

const STATUS_BADGE: Record<TicketStatus, { cls: string; label: string }> = {
  submitted: { cls: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800', label: 'Submitted' },
  waiting: { cls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800', label: 'Waiting for Review' },
  resolved: { cls: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800', label: 'Resolved' },
  rejected: { cls: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800', label: 'Rejected' },
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
  const categoryLabel = (id: string) => IT_CATEGORIES.find((c) => c.id === id)?.name ?? id;
  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return s;
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setSort('newest');
  };

  return (
    <div className="space-y-5">
      {/* Filter + search bar */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.01)] p-4 sm:p-5">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:w-auto">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
              className="text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-violet-600 cursor-pointer"
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
              className="text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-violet-600 cursor-pointer"
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
              className="text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-violet-600 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button
              type="button"
              onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              className="flex items-center justify-center gap-1.5 p-2.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-all"
              title="Toggle sort order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-violet-600" />
              {sort === 'newest' ? 'Newest' : 'Oldest'}
            </button>
          </div>
        </div>
      </div>

      {/* Table / states */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
        {loading ? (
          <LoadingPanel message="Loading tickets…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setPage((p) => p)} />
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <h5 className="font-semibold text-sm text-slate-700 dark:text-slate-300">No matching tickets</h5>
            <p className="text-xs text-slate-400">Adjust your search or filters.</p>
            <button onClick={resetFilters} className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 cursor-pointer">
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="py-3.5 px-5">REQ Number</th>
                    <th className="py-3.5 px-4 w-[32%]">Category &amp; Summary</th>
                    <th className="py-3.5 px-4">Requester</th>
                    <th className="py-3.5 px-4">Raised</th>
                    <th className="py-3.5 px-4">Assignee</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {data.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket)}
                      className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-5 font-mono font-bold text-slate-800 dark:text-slate-100">{ticket.code}</td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 transition-colors line-clamp-1">
                          {ticket.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          <span className="font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            {categoryLabel(ticket.category)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> {ticket.requesterName}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{ticket.requesterDept}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{formatDate(ticket.createdAt)}</td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-medium">{ticket.assignedTo}</td>
                      <td className="py-4 px-4"><StatusBadge status={ticket.status} /></td>
                      <td className="py-4 px-5 text-right">
                        <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-violet-600 font-bold transition-all p-1.5 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="block lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 px-2 py-0.5 rounded">
                      {ticket.code}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{formatDate(ticket.createdAt)}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">{ticket.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">{categoryLabel(ticket.category)}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <User className="w-3" /> <span>{ticket.requesterName}</span>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
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
