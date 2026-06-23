// ============================================================================
// DeviceCheckoutModal — Hardware checkout workflow for return/replacement requests.
// Triggered when a hardware_request ticket is resolved with deviceActionType in ['return', 'replace'].
// User confirms device checkout details (condition, recipient), then onComplete triggers
// device update + ticket resolution.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, Truck, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';

interface DeviceCheckoutModalProps {
  ticketCode: string;
  deviceActionType: 'return' | 'replace';
  onComplete: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeviceCheckoutModal({
  ticketCode,
  deviceActionType,
  onComplete,
  onCancel,
  isLoading = false,
}: DeviceCheckoutModalProps) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [completing, setCompleting] = useState(false);
  const [deviceCondition, setDeviceCondition] = useState<'good' | 'damaged' | 'unknown'>('good');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const isReturn = deviceActionType === 'return';
  const title = isReturn ? 'Device Return Checkout' : 'Device Replacement Checkout';
  const description = isReturn
    ? 'Confirm the condition of the returned device and complete checkout.'
    : 'Confirm the condition of the device being replaced.';

  // Focus management + Escape to close (accessibility)
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleCheckoutDevice = async () => {
    setCompleting(true);
    try {
      // TODO: Call device checkout API when implemented
      // await api.checkoutDevice(ticketCode, {
      //   actionType: deviceActionType,
      //   condition: deviceCondition,
      //   notes: checkoutNotes,
      // });

      // For now, simulate the completion
      await new Promise((resolve) => setTimeout(resolve, 800));

      await onComplete();
      toast.success(
        `Device ${isReturn ? 'return' : 'replacement'} processed for ${ticketCode}.`
      );
    } catch (err) {
      toast.error('Failed to process device checkout. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-checkout-title"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-7">
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            aria-label="Close device checkout"
            className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>

          <h3 id="device-checkout-title" className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight text-center">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed">
            {description} ({ticketCode})
          </p>

          <div className="mt-6 space-y-5">
            {/* Device Condition */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-2 font-mono">
                Device Condition
              </label>
              <div className="space-y-2">
                {(['good', 'damaged', 'unknown'] as const).map((condition) => (
                  <label key={condition} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="condition"
                      value={condition}
                      checked={deviceCondition === condition}
                      onChange={(e) => setDeviceCondition(e.target.value as typeof condition)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                      {condition === 'good' && 'Good Condition'}
                      {condition === 'damaged' && 'Damaged'}
                      {condition === 'unknown' && 'Unknown / Not Assessed'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Checkout Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-2 font-mono">
                Additional Notes (Optional)
              </label>
              <textarea
                placeholder="e.g., Cosmetic scratches on screen, battery life degraded…"
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                rows={3}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            {deviceCondition === 'damaged' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Device will be routed to hardware repair/assessment before redeployment.</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={completing || isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCheckoutDevice}
            disabled={completing || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            {completing || isLoading ? (
              <Spinner label="Processing…" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Complete Checkout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
