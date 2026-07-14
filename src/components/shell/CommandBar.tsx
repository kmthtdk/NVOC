// ============================================================================
// CommandBar — the CMD+K global search the reference design calls for and the
// app never had.
//
// Search existed only *inside* each list: to find a ticket you first had to know
// to go to the ticket list. This searches tickets and devices together, from
// anywhere, and jumps straight to the record — which in a tool whose most common
// sentence is "have a look at this ticket" is the difference between two clicks
// and five.
//
// Deliberately thin: it reuses the existing search endpoints rather than adding
// a new one, and it navigates to routes that already exist.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { Ticket } from '../../types';
import { STATUS_META } from '../../data/statusMeta';
import { Search, CornerDownLeft, Loader2, Ticket as TicketIcon, Cpu } from 'lucide-react';

interface DeviceHit {
  id: number;
  code: string;
  assetCode: string | null;
  model: string;
  serialNumber: string;
  status: string;
}

type Hit =
  | { kind: 'ticket'; id: string; code: string; title: string; status: Ticket['status'] }
  | { kind: 'device'; id: number; code: string; title: string; sub: string };

const DEBOUNCE_MS = 250;

export default function CommandBar({
  canSeeDevices,
  ticketBasePath,
}: {
  canSeeDevices: boolean;
  /**
   * Where a ticket hit lands. It used to be hardcoded to /admin/tickets, which
   * a requester is not allowed to visit: the route guard bounced them to
   * /requests with `replace`, dropping the ?ticket= query string on the way out.
   * So the one thing the command bar exists for silently failed for the role
   * that files most of the tickets. `?ticket=` is read independently of the
   * path, so the base just has to be a route this user may actually be on.
   */
  ticketBasePath: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K from anywhere. Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else {
      setQ('');
      setHits([]);
      setActive(0);
    }
  }, [open]);

  const search = useCallback(
    async (term: string, signal: AbortSignal) => {
      // Requesters have no access to the device inventory (it exposes serials,
      // personnel and procurement data), so do not even ask on their behalf —
      // it would only ever come back 403.
      const [tickets, devices] = await Promise.all([
        api.listTickets({ q: term, page: 1, pageSize: 5, sort: 'newest' }, signal).catch(() => null),
        canSeeDevices
          ? api.listDevices(1, 5, { q: term }, signal).catch(() => null)
          : Promise.resolve(null),
      ]);

      const found: Hit[] = [];
      for (const t of tickets?.data ?? []) {
        found.push({ kind: 'ticket', id: t.id, code: t.code, title: t.title, status: t.status });
      }
      for (const d of (devices?.data ?? []) as DeviceHit[]) {
        found.push({
          kind: 'device',
          id: d.id,
          code: d.code,
          title: d.model,
          sub: [d.assetCode, d.serialNumber].filter(Boolean).join(' · '),
        });
      }

      return found;
    },
    [canSeeDevices],
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      search(term, ctrl.signal)
        .then((found) => {
          // The API calls swallow their own errors — including AbortError — and
          // resolve to null, so an aborted request still lands here, with an
          // empty result. Writing that to state would blank out the hits for the
          // keystroke that superseded it. Check the signal instead of trusting
          // that a cancelled request simply never returns.
          if (ctrl.signal.aborted) return;
          setHits(found);
          setActive(0);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, search]);

  const go = (hit: Hit) => {
    setOpen(false);
    if (hit.kind === 'ticket') {
      // The record rides in the query string, so these links are shareable too.
      navigate(`${ticketBasePath}?ticket=${hit.id}`);
    } else {
      navigate(`/admin/devices?q=${encodeURIComponent(hit.code)}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <>
      {/* The trigger, sitting where the reference puts it: centred in the top bar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 max-w-md cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600"
        aria-label={canSeeDevices ? 'Search tickets and devices' : 'Search tickets'}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 truncate sm:block">
          Search tickets{canSeeDevices ? ' and devices' : ''}…
        </span>
        <kbd className="hidden shrink-0 rounded-sm border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400 sm:block dark:border-slate-700">
          Ctrl K
        </kbd>
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Search by code, title${canSeeDevices ? ', model or serial' : ''}…`}
                className="flex-1 bg-transparent py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            {q.trim().length < 2 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                Type at least two characters.
              </p>
            ) : hits.length === 0 && !loading ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                Nothing matches “{q.trim()}”.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {hits.map((hit, i) => {
                  const selected = i === active;
                  return (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(hit)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selected ? 'bg-violet-50 dark:bg-violet-950/40' : ''
                        }`}
                      >
                        {hit.kind === 'ticket' ? (
                          <TicketIcon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                        ) : (
                          <Cpu className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="w-28 shrink-0 truncate font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {hit.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                          {hit.title}
                          {hit.kind === 'device' && hit.sub && (
                            <span className="ml-2 font-mono text-[10px] text-slate-400">{hit.sub}</span>
                          )}
                        </span>
                        {hit.kind === 'ticket' && (
                          <span
                            className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_META[hit.status].badge}`}
                          >
                            {STATUS_META[hit.status].label}
                          </span>
                        )}
                        {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
