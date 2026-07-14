// ============================================================================
// UnresolvedCustody — the to-do list the custody backfill left behind.
//
// devices.assigned_to used to be free text. Some of it ('Alice Tan') carries no
// email, so the migration could not map it to an account. It refused to guess —
// assigning an asset to the wrong person is worse than admitting we do not know —
// and wrote the row with user_id = NULL instead.
//
// Those rows need a human. Without this panel the only remediation on the
// airgapped Production PC is hand-written SQL on the console, which is how a
// migration turns into an incident. Renders nothing when the list is empty, so it
// disappears the day the work is done.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import type { AdminUser } from '../types';
import { AlertTriangle, UserCheck } from 'lucide-react';

interface UnresolvedRow {
  id: number;
  deviceId: number;
  userLabel: string;
  department: string | null;
  deviceCode?: string;
  assetCode?: string | null;
  model?: string;
  serialNumber?: string;
}

export default function UnresolvedCustody({ onResolved }: { onResolved?: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<UnresolvedRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [unresolved, userList] = await Promise.all([
        api.listUnresolvedAssignments(signal),
        api.listUsers(),
      ]);
      setRows(unresolved.data ?? []);
      setUsers(userList.users ?? []);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // Non-fatal: this is a hygiene panel, not the main flow.
      console.error('[UnresolvedCustody] load failed:', err);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const resolve = async (row: UnresolvedRow) => {
    const userId = Number(choice[row.id]);
    if (!userId) return;
    setSaving(row.id);
    try {
      await api.resolveAssignment(row.id, userId);
      toast.success(`${row.deviceCode ?? 'Device'} now points at a real account.`);
      await load();
      onResolved?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resolve this hand-over.');
    } finally {
      setSaving(null);
    }
  };

  // Nothing to fix — say nothing. The panel exists only while the debt does.
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start gap-3 border-b border-amber-200 px-5 py-3 dark:border-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
            {rows.length} hand-over{rows.length > 1 ? 's' : ''} not linked to an account
          </h3>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            These came from the old free-text “assigned to” field and carried no email, so nobody
            could be certain who holds them. Pick the right person — the system will not guess.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200 dark:divide-amber-900/70">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {row.deviceCode}
                {row.assetCode ? ` · ${row.assetCode}` : ''}
              </p>
              <p className="truncate text-sm text-slate-800 dark:text-slate-200">
                {row.model}
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  — recorded as “{row.userLabel}”
                  {row.department ? ` · ${row.department}` : ''}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={choice[row.id] ?? ''}
                onChange={(e) => setChoice({ ...choice, [row.id]: e.target.value })}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select the holder…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!choice[row.id] || saving === row.id}
                onClick={() => resolve(row)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Link
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
