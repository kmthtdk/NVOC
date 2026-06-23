// ============================================================================
// ConfirmationModal — success acknowledgement shown right after a ticket is
// created. Presents the generated REQ code prominently and lets the user jump
// straight into the new ticket's detail view.
// ============================================================================

import React, { useEffect, useRef } from 'react';
import type { Ticket } from '../types';
import { CheckCircle2, X, ArrowRight, Copy } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ConfirmationModalProps {
  ticket: Ticket;
  onClose: () => void;
  onViewTicket: () => void;
}

export default function ConfirmationModal({ ticket, onClose, onViewTicket }: ConfirmationModalProps) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus management + Escape to close (accessibility).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(ticket.code);
      toast.success(`Copied ${ticket.code} to clipboard.`);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-7 text-center">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close confirmation"
            className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h3 id="confirm-title" className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            Request Submitted
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Your request has been logged and routed for triage. Use the reference below to track it.
          </p>

          <button
            type="button"
            onClick={copyCode}
            className="group mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-400 transition-colors cursor-pointer"
            title="Copy reference code"
          >
            <span className="font-mono font-extrabold text-base text-violet-700 dark:text-violet-300 tracking-wide">
              {ticket.code}
            </span>
            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500" />
          </button>

          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 truncate px-2">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{ticket.title}</span>
          </p>
        </div>

        <div className="px-6 py-4 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onViewTicket}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            View Ticket <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
