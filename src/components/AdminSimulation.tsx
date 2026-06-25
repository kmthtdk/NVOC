// ============================================================================
// AdminSimulation — IT dispatch console.
// Drives real status/assignee transitions through api.updateTicket (which
// returns 204; we surface success via toast and bump the parent reloadKey via
// onMutated so the dashboard + queue refresh). Also generates a downloadable
// CSV report of the loaded ticket set.
//
// Device Workflow Integration:
// When transitioning a hardware_request ticket to 'resolved' with a linked device:
// - If deviceActionType='new': show DeviceAssignmentModal
// - If deviceActionType in ['return','replace']: show DeviceCheckoutModal
// Modal completion triggers device update + ticket resolution (no double-resolve).
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import type { Ticket, TicketStatus } from '../types';
import { api, ApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';
import { Wrench, ChevronDown, Sparkles, FileCheck2, Download, AlertCircle } from 'lucide-react';
import DeviceAssignmentModal from './DeviceAssignmentModal';
import DeviceCheckoutModal from './DeviceCheckoutModal';

interface AdminSimulationProps {
  tickets: Ticket[];
  onMutated: () => void;
}

const ENGINEERS = [
  'Leon Hill (System Administrator)',
  'Marcus Vance (Network Advisor)',
  'Julian Beck (IT Support Specialist)',
  'Derrick Cole (Cyber Security Engineer)',
];

// ---- Device workflow state for modal handling ---
interface PendingDeviceWorkflow {
  ticketId: string;
  ticketCode: string;
  deviceActionType: 'new' | 'replace' | 'return';
  deviceId?: number;
  assignedTo: string;
  notes: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterDept?: string;
}

export default function AdminSimulation({ tickets, onMutated }: AdminSimulationProps) {
  const toast = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [newStatus, setNewStatus] = useState<TicketStatus>('waiting');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState(ENGINEERS[0]);
  const [saving, setSaving] = useState(false);

  // Device workflow modal state
  const [deviceWorkflow, setDeviceWorkflow] = useState<PendingDeviceWorkflow | null>(null);

  // Keep the selection valid as the ticket set refreshes.
  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicketId('');
      return;
    }
    if (!tickets.some((t) => t.id === selectedTicketId)) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [tickets, selectedTicketId]);

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const handleTicketChange = (id: string) => {
    setSelectedTicketId(id);
    const target = tickets.find((t) => t.id === id);
    if (target) {
      setNewStatus(target.status);
      setAssignedTo(target.assignedTo && target.assignedTo !== 'Unassigned' ? target.assignedTo : ENGINEERS[0]);
    }
  };

  // ---- Device workflow detection and modal dispatch ----
  // Checks if transitioning to 'resolved' on a hardware_request with a linked device
  const shouldTriggerDeviceWorkflow = (): boolean => {
    if (!activeTicket) return false;
    // Only trigger if moving to 'resolved' status
    if (newStatus !== 'resolved') return false;
    // Only for hardware_request category
    if (activeTicket.category !== 'hardware_request') return false;
    // Must have deviceActionType in details (proxy for "linked device")
    const actionType = activeTicket.details?.deviceActionType;
    // Trigger for 'new', 'replace', 'return' (not 'repair', which is in-situ)
    return actionType === 'new' || actionType === 'replace' || actionType === 'return';
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTicketId || !activeTicket) return;

    // ---- Device workflow branch ----
    if (shouldTriggerDeviceWorkflow()) {
      const actionType = activeTicket.details?.deviceActionType as 'new' | 'replace' | 'return';

      // Extract device ID from linked devices for return/replace actions
      let deviceId: number | undefined;
      if (actionType === 'new') {
        // For new devices, no device ID yet (will be created in modal)
        deviceId = undefined;
      } else if (actionType === 'return' || actionType === 'replace') {
        // For return/replace, device ID must exist
        deviceId = activeTicket.linkedDevices?.[0]?.deviceId;
        if (!deviceId) {
          toast.error('No device linked to this request. Cannot proceed with checkout.');
          return;
        }
      }

      setDeviceWorkflow({
        ticketId: selectedTicketId,
        ticketCode: activeTicket.code,
        deviceActionType: actionType,
        deviceId,
        assignedTo,
        notes: notes.trim() || 'Device assignment completed by IT engineer.',
        requesterName: activeTicket.requesterName,
        requesterEmail: activeTicket.requesterEmail,
        requesterDept: activeTicket.requesterDept,
      });
      // Don't call updateTicket yet; the modal's onComplete will do it.
      return;
    }

    // ---- Standard update (non-device workflow) ----
    setSaving(true);
    try {
      await api.updateTicket(selectedTicketId, {
        status: newStatus,
        assignedTo,
        notes: notes.trim() || 'Diagnostic log update by IT engineer.',
      });
      setNotes('');
      toast.success(`${activeTicket.code} updated and audit log appended.`);
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the ticket.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Device workflow completion handler ----
  const handleDeviceWorkflowComplete = async () => {
    if (!deviceWorkflow) return;
    setSaving(true);
    try {
      // TODO: Call device update API when implemented
      // await api.updateDevice(deviceId, { ...deviceData });

      // Mark ticket as resolved
      await api.updateTicket(deviceWorkflow.ticketId, {
        status: 'resolved',
        assignedTo: deviceWorkflow.assignedTo,
        notes: deviceWorkflow.notes,
      });
      setNotes('');
      toast.success(
        `${deviceWorkflow.ticketCode} device workflow completed and ticket resolved.`
      );
      setDeviceWorkflow(null);
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Device workflow failed.');
    } finally {
      setSaving(false);
    }
  };

  // ---- CSV report --------------------------------------------------------
  const handleExportReport = () => {
    if (tickets.length === 0) {
      toast.info('No tickets to export.');
      return;
    }
    const headers = ['Code', 'Title', 'Requester', 'Department', 'Category', 'Priority', 'Status', 'Assignee', 'Created'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = tickets.map((t) =>
      [t.code, t.title, t.requesterName, t.requesterDept, t.category, t.priority, t.status, t.assignedTo, t.createdAt]
        .map((v) => esc(String(v ?? '')))
        .join(','),
    );
    const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nvoc-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${tickets.length} tickets to CSV.`);
  };

  return (
    <>
      <div className="bg-slate-900 text-slate-150 rounded-lg border border-slate-800 shadow-md p-6 sm:p-7 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wider text-amber-500 uppercase bg-amber-500/10 rounded-full mb-3 border border-amber-500/20 font-mono">
              <Sparkles className="w-3 h-3 animate-pulse" /> Live Dispatch Console
            </div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-500" /> IT Specialist Dispatch
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Transition ticket states, assign engineers, and append audit-trail history. Changes persist to the backend.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" /> Export CSV Report
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" /> No tickets in the queue to dispatch.
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">1. Target Ticket</label>
                <div className="relative">
                  <select
                    value={selectedTicketId}
                    onChange={(e) => handleTicketChange(e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg py-2.5 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none font-medium"
                  >
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900">
                        {t.code} — {t.requesterName} ({t.title.slice(0, 32)}…)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute inset-y-0 right-3 my-auto w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {activeTicket && (
                  <div className="mt-1.5 px-2 py-1 bg-slate-800/40 rounded text-[10px] text-slate-400 flex justify-between">
                    <span>Status: <strong className="text-violet-400 uppercase font-mono">{activeTicket.status}</strong></span>
                    <span>Assigned: <strong>{activeTicket.assignedTo}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">2. New Status</label>
                <div className="relative">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg py-2.5 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none font-bold"
                  >
                    <option value="submitted" className="bg-slate-900">Submitted</option>
                    <option value="waiting" className="bg-slate-900">Waiting for Review</option>
                    <option value="resolved" className="bg-slate-900">Resolved</option>
                    <option value="rejected" className="bg-slate-900">Rejected</option>
                  </select>
                  <ChevronDown className="absolute inset-y-0 right-3 my-auto w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">3. Assign Engineer</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full text-xs bg-slate-800 border border-slate-700/80 rounded-lg py-2.5 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {ENGINEERS.map((eng) => (
                    <option key={eng} value={eng}>{eng}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-mono">4. Audit Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AD config complete, Group Policy synchronized…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg py-2.5 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/5 cursor-pointer transition-all"
              >
                {saving ? <Spinner label="Updating…" /> : (<><FileCheck2 className="w-4 h-4" /> Update State &amp; Log Audit</>)}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---- Device workflow modals ---- */}
      {deviceWorkflow && deviceWorkflow.deviceActionType === 'new' && activeTicket && (
        <DeviceAssignmentModal
          ticketCode={deviceWorkflow.ticketCode}
          ticketId={deviceWorkflow.ticketId}
          deviceType={activeTicket.details?.deviceType as string}
          requesterName={deviceWorkflow.requesterName}
          requesterEmail={deviceWorkflow.requesterEmail}
          requesterDept={deviceWorkflow.requesterDept}
          onComplete={handleDeviceWorkflowComplete}
          onCancel={() => setDeviceWorkflow(null)}
          isLoading={saving}
        />
      )}

      {deviceWorkflow && (deviceWorkflow.deviceActionType === 'return' || deviceWorkflow.deviceActionType === 'replace') && deviceWorkflow.deviceId && (
        <DeviceCheckoutModal
          ticketCode={deviceWorkflow.ticketCode}
          deviceId={deviceWorkflow.deviceId}
          deviceActionType={deviceWorkflow.deviceActionType}
          onComplete={handleDeviceWorkflowComplete}
          onCancel={() => setDeviceWorkflow(null)}
          isLoading={saving}
        />
      )}
    </>
  );
}
