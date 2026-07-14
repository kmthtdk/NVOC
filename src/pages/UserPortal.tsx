// UserPortal — the requester's own view: file a request, track your tickets.
// Extracted from App.tsx when routing moved into the URL; App is now a shell.

import { useEffect, useState } from 'react';
import type { Ticket, CategorySpec } from '../types';
import { isOpenStatus } from '../types';
import type { TicketStatus } from '../types';
import { STATUS_META } from '../data/statusMeta';
import type { UserTab } from '../navigation';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RequestForm from '../components/RequestForm';
import { LoadingPanel, ErrorState } from '../components/ui/Spinner';
import {
  Activity, AlertCircle, CheckCircle2, Clock, MessageSquare, Send, ShieldCheck, XCircle,
} from 'lucide-react';

export default function UserPortal({
  reloadKey,
  tab,
  onTabChange,
  onCreated,
  onSelectTicket,
  requesterEmail,
  categories,
}: {
  reloadKey: number;
  /** Driven by the route (/requests/new vs /requests), not local state. */
  tab: UserTab;
  onTabChange: (t: UserTab) => void;
  onCreated: (t: Ticket) => void;
  onSelectTicket: (t: Ticket) => void;
  requesterEmail: string | null;
  categories: CategorySpec[];
}) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    // Fetch only the current user's tickets via server-side filter for security.
    // If no requesterEmail is available, show empty state (do not fetch all tickets).
    if (!requesterEmail) {
      setTickets([]);
      setLoading(false);
      return;
    }
    api
      .listTickets({ page: 1, pageSize: 50, sort: 'newest', requesterEmail }, ctrl.signal)
      .then((res) => setTickets(res.data))
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Could not load your requests.');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [reloadKey, requesterEmail]);

  // Labels and colours come from the single status vocabulary (src/data/statusMeta.ts).
  // This used to be a fourth private copy, and the four had already drifted.
  const getStatusBadge = (st: TicketStatus) => STATUS_META[st].badge;
  const getStatusText = (st: TicketStatus) => STATUS_META[st].label;
  // Priority as a subtle left accent on each request card (echoes the mock's colour-coding).
  const getPriorityAccent = (p: string) =>
    p === 'urgent' ? 'border-l-rose-400 dark:border-l-rose-500'
    : p === 'high' ? 'border-l-amber-400 dark:border-l-amber-500'
    : p === 'medium' ? 'border-l-violet-400 dark:border-l-violet-500'
    : 'border-l-slate-300 dark:border-l-slate-600';

  const listToShow = tickets;

  // Jump to the list after submitting so the user sees their new request.
  const handleCreated = (t: Ticket) => {
    onCreated(t);
    onTabChange('requests');
  };

  const firstName = (user?.fullName ?? 'there').split(' ')[0];
  const isOpen = (t: Ticket) => isOpenStatus(t.status);
  const openCount = listToShow.filter(isOpen).length;
  const resolvedCount = listToShow.filter((t) => t.status === 'resolved').length;

  // Active Request Tracker: the requester's most-recent non-closed ticket.
  // `listToShow` is server-sorted newest-first, so the first open match is the latest.
  const activeTicket = listToShow.find(isOpen);

  // The approval step only appears while the ticket is actually sitting on an
  // approver — a request that needs no sign-off should not show a step it will
  // never pass through.
  const isAwaitingApproval = activeTicket?.status === 'pending_approval';
  const trackerIsWaiting = activeTicket?.status === 'waiting';

  const approvalStep = {
    label: 'Awaiting Approval',
    icon: ShieldCheck,
    sub: 'With your approver',
  };
  const trackerSteps: { label: string; icon: typeof Send; sub: string }[] = [
    {
      label: 'Submitted',
      icon: Send,
      sub: activeTicket
        ? new Date(activeTicket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '',
    },
    ...(isAwaitingApproval ? [approvalStep] : []),
    {
      label: 'Waiting for Review',
      icon: Clock,
      sub: trackerIsWaiting ? 'In review' : 'Pending',
    },
    { label: 'Resolved', icon: CheckCircle2, sub: 'Pending' },
  ];
  // Index into trackerSteps of the step the ticket is currently on. Both
  // 'pending_approval' and 'waiting' land on index 1: the approval step is only
  // in the array when the ticket is on it, so it never shifts 'waiting' along.
  const trackerStepIndex = !activeTicket ? -1 : activeTicket.status === 'submitted' ? 0 : 1;

  return (
    <div className="space-y-6">
      {/* Welcome hero (stitch user-dashboard). The tab bar that used to sit under
          it is gone — the rail owns navigation now. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-800 via-violet-700 to-violet-600 p-6 text-white shadow-sm sm:p-8">
        <div className="relative z-10">
          <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight lg:text-[40px]">
            Welcome back, {firstName}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/80">
            {listToShow.length === 0 ? (
              <>You have no requests yet. <span className="font-semibold text-white">New Request</span> files your first one.</>
            ) : (
              <>
                You have <span className="font-bold text-white">{openCount}</span> open request{openCount === 1 ? '' : 's'}
                {resolvedCount > 0 && <> · <span className="font-bold text-white">{resolvedCount}</span> resolved</>}.
              </>
            )}
          </p>
        </div>
        {/* subtle grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      {tab === 'new' && <RequestForm onCreated={handleCreated} categories={categories} />}

      {tab === 'requests' && (
        <div className="space-y-6">
        {/* Active Request Tracker — mirrors the mock's "Active Incident Tracker".
            Only shown once the list has loaded so we never flash an empty tracker. */}
        {!loading && !error && (
          <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.015)] p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-violet-500" /> Active Request Tracker
                </h3>
                {activeTicket ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug truncate">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{activeTicket.code}</span>
                    {' · '}
                    {activeTicket.title}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Nothing in progress right now
                  </p>
                )}
              </div>
              {activeTicket && (
                <button
                  type="button"
                  onClick={() => onSelectTicket(activeTicket)}
                  className="shrink-0 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  View Details
                </button>
              )}
            </div>

            {activeTicket ? (
              <>
                <div className="flex items-start">
                  {trackerSteps.map((step, i) => {
                    const isDone = i < trackerStepIndex;
                    const isCurrent = i === trackerStepIndex;
                    const StepIcon = isDone ? CheckCircle2 : step.icon;
                    const circleCls = isDone
                      ? 'bg-violet-500 text-white border-2 border-transparent'
                      : isCurrent
                        ? `bg-white dark:bg-slate-900 border-2 animate-pulse ${
                            trackerIsWaiting
                              ? 'border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400'
                              : 'border-violet-500 dark:border-violet-400 text-violet-600 dark:text-violet-400'
                          }`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-2 border-transparent';
                    const labelCls = isDone
                      ? 'text-slate-700 dark:text-slate-300'
                      : isCurrent
                        ? trackerIsWaiting
                          ? 'text-amber-600 dark:text-amber-400 font-bold'
                          : 'text-violet-600 dark:text-violet-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500';
                    return (
                      <div key={step.label} className="flex-1 flex flex-col items-center relative">
                        {/* connector to the next step; fills violet once this step is complete */}
                        {i < trackerSteps.length - 1 && (
                          <div className="absolute top-5 left-1/2 w-full h-0.5">
                            <div className="h-full w-full bg-slate-200 dark:bg-slate-700" />
                            {isDone && <div className="absolute inset-0 bg-violet-500 dark:bg-violet-400" />}
                          </div>
                        )}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${circleCls}`}>
                          <StepIcon className="w-4 h-4" />
                        </div>
                        <p className={`mt-2 text-[10px] text-center leading-tight ${labelCls}`}>{step.label}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center leading-tight">{step.sub}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Rejected is a terminal branch, never an active step — surfaced as a legend. */}
                <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                  <XCircle className="w-3 h-3 text-rose-400" />
                  <span>
                    Requests may alternatively close as{' '}
                    <span className="font-semibold text-rose-500 dark:text-rose-400">Rejected</span> after review.
                  </span>
                </div>
              </>
            ) : (
              <div className="py-6 px-4 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 dark:text-emerald-700" />
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">You&apos;re all caught up</p>
                <p className="text-[10px] text-slate-400 leading-tight max-w-xs mx-auto">
                  No open requests to track. New submissions will appear here with a live status timeline.
                </p>
              </div>
            )}
          </div>
        )}

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listToShow.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className={`p-3.5 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/30 dark:hover:bg-slate-800 border border-l-4 border-slate-200 dark:border-slate-700 hover:border-slate-300 rounded-lg transition-all cursor-pointer group flex flex-col gap-2.5 ${getPriorityAccent(ticket.priority)}`}
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
                    <span className="truncate">
                      IT: {ticket.assignedTo || 'Unassigned'}
                      <span className="text-slate-300 dark:text-slate-600">
                        {' · '}
                        {new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 text-violet-600 font-sans font-semibold shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" /> Details &amp; Chat
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
