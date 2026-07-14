// ============================================================================
// The ticket status vocabulary — labels and colours — in ONE place.
//
// This lived in four independent copies (StatusDashboard, TicketList,
// TicketDetailModal, UserPortal). They had already drifted, and every new surface
// meant a fifth copy that would drift on day one. Adding a status now means
// editing this file; the compiler finds everything else.
//
// Palette rules (see the @theme remap in src/index.css):
//   violet -> teal primary   submitted     (queued for IT triage)
//   indigo -> periwinkle     pending_approval (parked on an approver, NOT an alarm)
//   amber                    waiting       (IT is working it)
//   emerald                  resolved
//   rose                     rejected
// Do not introduce a hue that is not remapped in @theme — that is exactly how
// stock-Tailwind indigo/red/yellow leaked in before.
// ============================================================================

import type { TicketStatus } from '../types';

export interface StatusMeta {
  /** Human label. */
  label: string;
  /** Longer label where there is room for it (detail view). */
  longLabel: string;
  /** Solid dot, for legends and dashboards. */
  dot: string;
  /** Text-only colour. */
  text: string;
  /** Full badge: background + text + border, light and dark. */
  badge: string;
}

export const STATUS_META: Record<TicketStatus, StatusMeta> = {
  submitted: {
    label: 'Submitted',
    longLabel: 'Submitted — Pending Triage',
    dot: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
    badge:
      'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800',
  },
  pending_approval: {
    label: 'Awaiting Approval',
    longLabel: 'Awaiting Approval',
    dot: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge:
      'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800',
  },
  waiting: {
    label: 'Waiting for Review',
    longLabel: 'Waiting for Review',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    badge:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800',
  },
  resolved: {
    label: 'Resolved',
    longLabel: 'Resolved',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
  },
  rejected: {
    label: 'Rejected',
    longLabel: 'Rejected',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    badge:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800',
  },
};

export const statusLabel = (s: TicketStatus): string => STATUS_META[s].label;
export const statusBadge = (s: TicketStatus): string => STATUS_META[s].badge;
