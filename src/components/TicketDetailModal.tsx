// ============================================================================
// TicketDetailModal — full ticket view.
// Takes only a ticketId and fetches the complete record (nested comments,
// history, attachments) via api.getTicket on open, since list rows are
// summaries. Supports:
//   - posting comments (author/role derived from the authenticated user)
//   - downloading attachments (auth header can't ride an <a href>, so we fetch)
//   - inline status/priority/assignee editing for it_support/admin
//   - status history timeline
// Every mutation refetches local detail AND calls onMutated() so parent lists
// refresh too.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner, LoadingPanel, ErrorState } from './ui/Spinner';
import DeviceAssignmentModal from './DeviceAssignmentModal';
import DeviceCheckoutModal from './DeviceCheckoutModal';
import {
  X, Clock, User, Send, Building, Server, MessageSquare, History, Paperclip,
  Download, Settings2, Save,
} from 'lucide-react';

interface TicketDetailModalProps {
  ticketId: string;
  onClose: () => void;
  onMutated: () => void;
}

const STATUS_COLOR: Record<TicketStatus, string> = {
  submitted: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  waiting: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  resolved: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  rejected: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  submitted: 'Submitted - Pending Triage',
  waiting: 'Waiting for Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return s;
  }
};
const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function TicketDetailModal({ ticketId, onClose, onMutated }: TicketDetailModalProps) {
  const { user, isITSupport } = useAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // Admin edit panel state.
  const [showEdit, setShowEdit] = useState(false);
  const [editStatus, setEditStatus] = useState<TicketStatus>('waiting');
  const [editPriority, setEditPriority] = useState<TicketPriority>('medium');
  const [editAssignee, setEditAssignee] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Device workflow state
  const [deviceWorkflow, setDeviceWorkflow] = useState<{
    ticketCode: string;
    deviceActionType: 'new' | 'replace' | 'return';
    deviceId?: number;
    requesterName?: string;
    requesterEmail?: string;
    requesterDept?: string;
  } | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    status: TicketStatus;
    priority: TicketPriority;
    assignedTo: string;
    notes: string;
  } | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      return api
        .getTicket(ticketId, signal)
        .then(({ ticket: t }) => {
          setTicket(t);
          setEditStatus(t.status);
          setEditPriority(t.priority);
          setEditAssignee(t.assignedTo && t.assignedTo !== 'Unassigned' ? t.assignedTo : '');
        })
        .catch((err) => {
          if ((err as Error)?.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Could not load this ticket.');
        })
        .finally(() => setLoading(false));
    },
    [ticketId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Escape closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticket || !user) return;
    setPosting(true);
    // Role is derived from the authenticated user — admin maps to it_support
    // (the comment enum has no 'admin').
    const role = isITSupport ? 'it_support' : 'requester';
    try {
      await api.addComment(ticket.id, { author: user.fullName, role, content: newComment.trim() });
      setNewComment('');
      toast.success('Comment posted.');
      await load();
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not post comment.');
    } finally {
      setPosting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    // Check if this is a hardware request being resolved with device workflow
    const deviceActionType = ticket.details?.deviceActionType as 'new' | 'replace' | 'return' | undefined;

    if (
      editStatus === 'resolved' &&
      ticket.category === 'hardware_request' &&
      deviceActionType &&
      ['new', 'replace', 'return'].includes(deviceActionType)
    ) {
      // Extract device ID for return/replace actions
      let deviceId: number | undefined;
      if (deviceActionType === 'new') {
        // For new devices, no device ID yet (will be created in modal)
        deviceId = undefined;
      } else if (deviceActionType === 'return' || deviceActionType === 'replace') {
        // For return/replace, device ID must exist
        deviceId = ticket.linkedDevices?.[0]?.deviceId;
        if (!deviceId) {
          toast.error('No device linked to this request. Cannot proceed with checkout.');
          return;
        }
      }

      // Show device workflow modal instead of saving directly
      setDeviceWorkflow({
        ticketCode: ticket.code,
        deviceActionType,
        deviceId,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        requesterDept: ticket.requesterDept,
      });
      setPendingUpdate({
        status: editStatus,
        priority: editPriority,
        assignedTo: editAssignee.trim() || 'Unassigned',
        notes: editNotes.trim() || undefined,
      });
      return;
    }

    // Standard update without device workflow
    setSavingEdit(true);
    try {
      await api.updateTicket(ticket.id, {
        status: editStatus,
        priority: editPriority,
        assignedTo: editAssignee.trim() || 'Unassigned',
        notes: editNotes.trim() || undefined,
      });
      setEditNotes('');
      setShowEdit(false);
      toast.success('Ticket updated.');
      await load();
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the ticket.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeviceWorkflowComplete = async () => {
    if (!ticket || !pendingUpdate) return;
    setSavingEdit(true);
    try {
      // Save the ticket update
      await api.updateTicket(ticket.id, {
        status: pendingUpdate.status,
        priority: pendingUpdate.priority,
        assignedTo: pendingUpdate.assignedTo,
        notes: pendingUpdate.notes,
      });
      setEditNotes('');
      setShowEdit(false);
      setDeviceWorkflow(null);
      setPendingUpdate(null);
      toast.success('Ticket resolved and device assigned.');
      await load();
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the ticket.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDownload = async (attId: string, name: string) => {
    setDownloadingId(attId);
    try {
      const blob = await api.downloadAttachment(attId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const detailEntries = ticket?.details
    ? (Object.entries(ticket.details) as [string, unknown][]).filter(
        ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
      )
    : [];

  const prettyKey = (k: string) =>
    k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
  const prettyVal = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono font-bold text-xs bg-slate-200/85 dark:bg-slate-700 px-3 py-1 rounded text-slate-800 dark:text-slate-100 shrink-0">
              {ticket?.code ?? '…'}
            </span>
            {ticket && (
              <span className={`text-xs px-2.5 py-1 font-bold rounded border ${STATUS_COLOR[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isITSupport && ticket && (
              <button
                type="button"
                onClick={() => setShowEdit((s) => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  showEdit
                    ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Manage
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-full text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <LoadingPanel message="Loading ticket details…" />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load()} />
          ) : ticket ? (
            <>
              {/* Title + meta */}
              <div>
                <h2 className="text-lg font-extrabold text-slate-950 dark:text-white leading-snug tracking-tight">{ticket.title}</h2>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {ticket.requesterName} ({ticket.requesterEmail})</span>
                  <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5 text-slate-400" /> {ticket.requesterDept}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Raised: {formatDate(ticket.createdAt)}</span>
                </div>
              </div>

              {/* Admin edit panel */}
              {showEdit && isITSupport && (
                <form onSubmit={handleSaveEdit} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-3 animate-fadeIn">
                  <h4 className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-widest font-mono">Manage Ticket</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase font-mono">Status</label>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TicketStatus)} className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                        <option value="submitted">Submitted</option>
                        <option value="waiting">Waiting for Review</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase font-mono">Priority</label>
                      <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TicketPriority)} className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase font-mono">Assignee</label>
                      <input type="text" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} placeholder="Engineer name" className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase font-mono">Audit Note (added to history)</label>
                    <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="e.g. Assigned to network team, investigating…" className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs cursor-pointer transition-colors">
                      {savingEdit ? <Spinner label="Saving…" /> : (<><Save className="w-3.5 h-3.5" /> Save changes</>)}
                    </button>
                  </div>
                </form>
              )}

              {/* Description */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Request Context</h4>
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">{ticket.description}</p>
              </div>

              {/* Technical specs */}
              {detailEntries.length > 0 && (
                <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 font-mono">
                    <Server className="w-4 h-4" /> Technical Specifications
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {detailEntries.map(([k, v]) => (
                      <div key={k}>
                        <span className="text-slate-400">{prettyKey(k)}:</span>{' '}
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold break-words">{prettyVal(v)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono mb-1">
                    <Paperclip className="w-3.5 h-3.5" /> Attachments ({ticket.attachments.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {ticket.attachments.map((att) => (
                      <li key={att.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                        <span className="flex items-center gap-2 min-w-0">
                          <Paperclip className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">{att.originalName}</span>
                          <span className="text-slate-400 font-mono shrink-0">{formatBytes(att.sizeBytes)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownload(att.id, att.originalName)}
                          disabled={downloadingId === att.id}
                          className="flex items-center gap-1 text-violet-600 hover:text-violet-800 disabled:opacity-50 font-bold shrink-0 cursor-pointer transition-colors"
                        >
                          {downloadingId === att.id ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timeline + comments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* History */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-violet-600" /> Status History
                  </h3>
                  <div className="border-l-2 border-slate-150 dark:border-slate-700 pl-5 ml-2.5 space-y-5">
                    {ticket.history.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No history yet.</p>
                    ) : (
                      ticket.history.map((hist, index) => {
                        const isLast = index === ticket.history.length - 1;
                        return (
                          <div key={hist.id} className="relative">
                            <span className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 ${isLast ? 'bg-violet-600 border-violet-200 ring-4 ring-violet-50 dark:ring-violet-950' : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-900'}`} />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[12px] ${isLast ? 'text-violet-900 dark:text-violet-300 font-extrabold' : 'text-slate-700 dark:text-slate-200 font-semibold'}`}>{hist.statusLabel}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{formatDate(hist.createdAt)}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">By: {hist.updatedBy}</div>
                              {hist.notes && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-100 dark:border-slate-700 italic leading-relaxed">{hist.notes}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {ticket.assignedTo && (
                    <div className="p-3 bg-violet-50/40 dark:bg-violet-950/30 rounded-xl border border-violet-100 dark:border-violet-900 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Assigned Engineer:</span>
                      <span className="font-bold text-violet-800 dark:text-violet-300">{ticket.assignedTo}</span>
                    </div>
                  )}
                </div>

                {/* Comments */}
                <div className="space-y-4 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-violet-600" /> Comments
                  </h3>
                  <div className="border border-slate-150 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 p-3 max-h-[260px] overflow-y-auto space-y-3">
                    {ticket.comments.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        <p>No comments yet.</p>
                        <p className="text-[10px] mt-1">Start the conversation below.</p>
                      </div>
                    ) : (
                      ticket.comments.map((comm) => (
                        <div key={comm.id} className={`p-2.5 rounded-lg max-w-[85%] text-xs flex flex-col ${comm.role === 'it_support' ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-900 dark:text-violet-200 ml-auto border border-violet-100 dark:border-violet-800' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 mr-auto border border-slate-100 dark:border-slate-700'}`}>
                          <div className="flex items-center justify-between gap-4 font-bold text-[10px] mb-1">
                            <span className={comm.role === 'it_support' ? 'text-violet-800 dark:text-violet-300 font-extrabold' : 'text-slate-600 dark:text-slate-300'}>
                              {comm.author} {comm.role === 'it_support' ? '(IT)' : '(User)'}
                            </span>
                            <span className="text-slate-400 font-normal font-mono">{formatDate(comm.createdAt)}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-line">{comm.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handlePostComment} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      <span>Posting as</span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                        {user?.fullName} · {isITSupport ? 'IT' : 'Requester'}
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={2}
                        required
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment…"
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 pb-8"
                      />
                      <button type="submit" disabled={posting} className="absolute right-2 bottom-2 p-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer transition-colors">
                        {posting ? <Spinner className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Device Assignment Modal */}
      {deviceWorkflow && deviceWorkflow.deviceActionType === 'new' && (
        <DeviceAssignmentModal
          ticketCode={deviceWorkflow.ticketCode}
          requesterName={deviceWorkflow.requesterName}
          requesterEmail={deviceWorkflow.requesterEmail}
          requesterDept={deviceWorkflow.requesterDept}
          onComplete={handleDeviceWorkflowComplete}
          onCancel={() => {
            setDeviceWorkflow(null);
            setPendingUpdate(null);
          }}
          isLoading={savingEdit}
        />
      )}

      {/* Device Checkout Modal */}
      {deviceWorkflow && (deviceWorkflow.deviceActionType === 'return' || deviceWorkflow.deviceActionType === 'replace') && deviceWorkflow.deviceId && (
        <DeviceCheckoutModal
          ticketCode={deviceWorkflow.ticketCode}
          deviceId={deviceWorkflow.deviceId}
          deviceActionType={deviceWorkflow.deviceActionType}
          onComplete={handleDeviceWorkflowComplete}
          onCancel={() => {
            setDeviceWorkflow(null);
            setPendingUpdate(null);
          }}
          isLoading={savingEdit}
        />
      )}
    </div>
  );
}
