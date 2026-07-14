// ============================================================================
// DeviceAllocationQueue — match a waiting hardware request to a free device.
//
// Two columns: open hardware_request tickets on the left, in-stock devices on the
// right, and one button that hands the device over. Both datasets already existed
// (GET /tickets/reports/pending-hardware, GET /devices?status=In Stock) — what was
// missing was the surface that puts them side by side.
//
// Custody is written through the ONE door: api.assignDevice -> POST /devices/:id/assign.
// The server resolves the holder's account from their email, so this screen cannot
// re-create the orphan-row bug by forgetting to pass an id.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { PendingHardwareRequest } from '../api/client';
import { useToast } from '../context/ToastContext';
import { LoadingPanel, Spinner } from './ui/Spinner';
import { Inbox, PackageCheck, ArrowRight, AlertTriangle } from 'lucide-react';

interface StockDevice {
  id: number;
  code: string;
  assetCode: string | null;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: string;
  specifications?: {
    cpu?: string | null;
    ramGb?: number | null;
    storageGb?: number | null;
    storageType?: string | null;
  } | null;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: 'border-l-rose-500',
  high: 'border-l-amber-500',
  medium: 'border-l-slate-400',
  low: 'border-l-slate-300 dark:border-l-slate-600',
};

const daysWaiting = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

const panelClass =
  'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden';
const columnHeadClass =
  'flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900';
const columnTitleClass =
  'text-[11px] font-extrabold uppercase tracking-widest font-mono text-slate-500 dark:text-slate-400';

export default function DeviceAllocationQueue({ onMutated }: { onMutated?: () => void }) {
  const toast = useToast();

  const [requests, setRequests] = useState<PendingHardwareRequest[]>([]);
  const [devices, setDevices] = useState<StockDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [pending, stock] = await Promise.all([
        api.getPendingHardwareReport(signal),
        api.listDevices(1, 100, { status: 'In Stock' }),
      ]);
      setRequests(pending.pendingRequests ?? []);
      setDevices(stock.data ?? []);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load the allocation queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Longest-waiting first, urgent ahead of that. The point of a queue is that the
  // person who has been waiting three days is not buried under one filed today.
  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [requests],
  );

  const ticket = sortedRequests.find((r) => String(r.id) === selectedTicket) ?? null;
  const device = devices.find((d) => d.id === selectedDevice) ?? null;
  const canAssign = !!ticket && !!device && !assigning;

  const handleAssign = async () => {
    if (!ticket || !device) return;
    setAssigning(true);
    try {
      await api.assignDevice(
        device.id,
        ticket.requester_name,
        ticket.requester_email,
        ticket.requester_dept ?? undefined,
        String(ticket.id),
        `Issued from the allocation queue for ${ticket.code}`,
      );
      toast.success(`${device.code} issued to ${ticket.requester_name}.`);
      setSelectedTicket(null);
      setSelectedDevice(null);
      await load();
      onMutated?.();
    } catch (err) {
      // A 400 here is the server refusing to issue to an email with no account —
      // the deliberate alternative to silently writing an orphan custody row.
      toast.error(err instanceof ApiError ? err.message : 'Could not issue the device.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <LoadingPanel message="Loading the allocation queue…" />;

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title comes from the shell's PageHeader — it was printed twice. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---- Waiting requests -------------------------------------------- */}
        <div className={panelClass}>
          <div className={columnHeadClass}>
            <h4 className={columnTitleClass}>
              <Inbox className="mr-1.5 inline h-3.5 w-3.5" />
              Waiting for hardware
            </h4>
            <span className="font-mono text-xs font-bold text-slate-500">{sortedRequests.length}</span>
          </div>

          {sortedRequests.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs italic text-slate-400">
              Nobody is waiting on hardware.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {sortedRequests.map((r) => {
                const active = String(r.id) === selectedTicket;
                const waited = daysWaiting(r.created_at);
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTicket(active ? null : String(r.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTicket(active ? null : String(r.id));
                      }
                    }}
                    className={`cursor-pointer border-l-4 px-5 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                      PRIORITY_ACCENT[r.priority] ?? 'border-l-slate-300'
                    } ${
                      active
                        ? 'bg-violet-50 dark:bg-violet-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-violet-700 dark:text-violet-300">
                          {r.code}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {r.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {r.requester_name}
                          {r.requester_dept ? ` · ${r.requester_dept}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[10px] font-bold uppercase text-slate-400">
                          {r.priority}
                        </p>
                        <p
                          className={`mt-1 text-[11px] font-semibold ${
                            waited >= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {waited === 0 ? 'today' : `${waited}d waiting`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Free devices ------------------------------------------------ */}
        <div className={panelClass}>
          <div className={columnHeadClass}>
            <h4 className={columnTitleClass}>
              <PackageCheck className="mr-1.5 inline h-3.5 w-3.5" />
              Ready to issue
            </h4>
            <span className="font-mono text-xs font-bold text-slate-500">{devices.length}</span>
          </div>

          {devices.length === 0 ? (
            <div className="m-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-amber-800 dark:text-amber-300">
                No devices in stock. Check whether anything can be returned to inventory.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {devices.map((d) => {
                const active = d.id === selectedDevice;
                const spec = d.specifications;
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDevice(active ? null : d.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDevice(active ? null : d.id);
                      }
                    }}
                    className={`cursor-pointer px-5 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                      active
                        ? 'bg-violet-50 dark:bg-violet-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {d.model}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {d.code}
                          {d.assetCode ? ` · ${d.assetCode}` : ''}
                        </p>
                        {spec && (spec.ramGb || spec.storageGb || spec.cpu) && (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {[
                              spec.cpu,
                              spec.ramGb ? `${spec.ramGb}GB RAM` : null,
                              spec.storageGb
                                ? `${spec.storageGb}GB ${spec.storageType ?? ''}`.trim()
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        In Stock
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- The match --------------------------------------------------- */}
      <div className={`${panelClass} p-4`}>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {ticket && device ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-violet-700 dark:text-violet-300">
                  {ticket.code}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                  {device.code}
                </span>
                <span className="text-slate-500">
                  — issue {device.model} to {ticket.requester_name}
                </span>
              </span>
            ) : (
              'Pick one request and one device.'
            )}
          </p>

          <button
            type="button"
            disabled={!canAssign}
            onClick={handleAssign}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {assigning ? <Spinner /> : <PackageCheck className="h-4 w-4" />}
            Issue device
          </button>
        </div>
      </div>
    </div>
  );
}
