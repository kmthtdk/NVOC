// Reusable loading primitives: an inline spinner and a full-panel loading state.
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Small inline spinner (e.g. inside buttons). */
export function Spinner({ className = 'w-4 h-4', label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Centered block-level loading state for panels and lists. */
export function LoadingPanel({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 dark:text-slate-500">
      <Loader2 className="w-7 h-7 animate-spin text-violet-600" aria-hidden="true" />
      <p className="text-xs font-semibold tracking-tight">{message}</p>
    </div>
  );
}

/** Inline error banner with optional retry. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Something went wrong</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-4 py-2 text-xs font-bold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}
