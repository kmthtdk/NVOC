import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import type { AdminUser, ApprovalConfig, ApprovalConfigStep, DepartmentLeaderRow } from '../types';
import { ShieldCheck, Plus, Trash2, Save, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

const APPROVER_TYPES: Array<{ value: ApprovalConfigStep['approverType']; label: string }> = [
  { value: 'requester_leader', label: "Requester's Leader" },
  { value: 'it_leader', label: 'IT Leader' },
  { value: 'user', label: 'Specific User' },
];

// min-w-0: a <select> sizes itself to its widest option ("Full Name · role"), and
// as a flex item its min-width defaults to auto — so these rows refused to shrink
// and ran off the right edge of a phone. The old shell hid that with a blanket
// overflow-x-hidden on the root; the row was always broken, it just could not be
// seen or scrolled to.
const inputCls =
  'min-w-0 text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100';

/**
 * Admin page to configure the DEFAULT approval flow + leader resolution.
 * (Per-category/request-type flows are schema-ready; this edits the global default.)
 */
export default function ApprovalSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cfg, setCfg] = useState<ApprovalConfig | null>(null);
  const [newDept, setNewDept] = useState('');
  const [newDeptLeader, setNewDeptLeader] = useState<number | ''>('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.getApprovalConfig(), api.listUsers()])
      .then(([c, u]) => {
        if (!alive) return;
        setCfg(c);
        setUsers(u.users);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Could not load approval settings.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [toast]);

  if (loading || !cfg) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading approval settings…
      </div>
    );
  }

  const setSteps = (steps: ApprovalConfigStep[]) => setCfg({ ...cfg, steps });
  const updateStep = (i: number, patch: Partial<ApprovalConfigStep>) =>
    setSteps(cfg.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () =>
    setSteps([...cfg.steps, { approverType: 'user', approverUserId: null, label: null }]);
  const removeStep = (i: number) => setSteps(cfg.steps.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cfg.steps.length) return;
    const arr = [...cfg.steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSteps(arr);
  };

  const setLeaders = (departmentLeaders: DepartmentLeaderRow[]) =>
    setCfg({ ...cfg, departmentLeaders });
  const addLeader = () => {
    if (!newDept.trim() || !newDeptLeader) return;
    const u = users.find((x) => x.id === Number(newDeptLeader));
    setLeaders([
      ...cfg.departmentLeaders.filter((d) => d.department !== newDept.trim()),
      { department: newDept.trim(), leader_user_id: Number(newDeptLeader), leader_name: u?.fullName ?? null },
    ]);
    setNewDept('');
    setNewDeptLeader('');
  };
  const removeLeader = (dept: string) =>
    setLeaders(cfg.departmentLeaders.filter((d) => d.department !== dept));

  const save = async () => {
    // Guard: 'user' steps need a user chosen.
    if (cfg.steps.some((s) => s.approverType === 'user' && !s.approverUserId)) {
      toast.error('Every "Specific User" step needs a user selected.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateApprovalConfig({
        approvalEnabled: cfg.approvalEnabled,
        itLeaderUserId: cfg.itLeaderUserId,
        steps: cfg.steps.map((s) => ({
          approverType: s.approverType,
          approverUserId: s.approverType === 'user' ? s.approverUserId : null,
          label: s.label,
        })),
        departmentLeaders: cfg.departmentLeaders.map((d) => ({
          department: d.department,
          leaderUserId: d.leader_user_id,
        })),
      });
      setCfg(updated);
      toast.success('Approval settings saved.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save approval settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-violet-700 dark:text-violet-400" /> Approval Settings
        </h2>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Master toggle */}
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <input
          type="checkbox"
          checked={cfg.approvalEnabled}
          onChange={(e) => setCfg({ ...cfg, approvalEnabled: e.target.checked })}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Require approval for new requests
        </span>
      </label>

      {/* Default flow steps */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Default approval chain</h3>
          <button type="button" onClick={addStep} className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-800">
            <Plus className="w-3.5 h-3.5" /> Add step
          </button>
        </div>
        <ol className="space-y-2">
          {cfg.steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2">
              <span className="text-[10px] font-mono text-slate-400 w-4 text-right">{i + 1}</span>
              <select
                value={s.approverType}
                onChange={(e) => updateStep(i, { approverType: e.target.value as ApprovalConfigStep['approverType'] })}
                className={inputCls}
              >
                {APPROVER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {s.approverType === 'user' && (
                <select
                  value={s.approverUserId ?? ''}
                  onChange={(e) => updateStep(i, { approverUserId: e.target.value ? Number(e.target.value) : null })}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">Select user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} · {u.role}</option>
                  ))}
                </select>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => moveStep(i, -1)} className="p-1 text-slate-400 hover:text-slate-700"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => moveStep(i, 1)} className="p-1 text-slate-400 hover:text-slate-700"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => removeStep(i)} className="p-1 text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </li>
          ))}
          {cfg.steps.length === 0 && (
            <p className="text-xs text-slate-400 italic">No steps — new requests will be auto-approved.</p>
          )}
        </ol>
      </section>

      {/* Leader resolution */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Leader resolution</h3>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">IT Leader (for the "IT Leader" step)</label>
          <select
            value={cfg.itLeaderUserId ?? ''}
            onChange={(e) => setCfg({ ...cfg, itLeaderUserId: e.target.value ? Number(e.target.value) : null })}
            className={`${inputCls} w-full`}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} · {u.role}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2">Department leaders (for the "Requester's Leader" step)</label>
          <ul className="space-y-2">
            {cfg.departmentLeaders.map((d) => (
              <li key={d.department} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{d.department}</span>
                <select
                  value={d.leader_user_id}
                  onChange={(e) =>
                    setLeaders(
                      cfg.departmentLeaders.map((x) =>
                        x.department === d.department ? { ...x, leader_user_id: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className={inputCls}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeLeader(d.department)} className="p-1 text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="Department name"
              className={`${inputCls} flex-1`}
            />
            <select
              value={newDeptLeader}
              onChange={(e) => setNewDeptLeader(e.target.value ? Number(e.target.value) : '')}
              className={inputCls}
            >
              <option value="">Leader…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
            <button type="button" onClick={addLeader} className="px-2.5 py-2 text-xs font-bold rounded-lg bg-slate-700 text-white hover:bg-slate-800">Add</button>
          </div>
        </div>
      </section>
    </div>
  );
}
