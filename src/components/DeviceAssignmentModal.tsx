// ============================================================================
// DeviceAssignmentModal — Hardware assignment workflow for new device requests.
// Triggered when a hardware_request ticket is resolved with deviceActionType='new'.
// User selects/confirms device inventory allocation, then onComplete triggers
// device update + ticket resolution.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, Package, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';

interface DeviceAssignmentModalProps {
  ticketCode: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeviceAssignmentModal({
  ticketCode,
  onComplete,
  onCancel,
  isLoading = false,
}: DeviceAssignmentModalProps) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [completing, setCompleting] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Placeholder device inventory (in real implementation, fetch from API)
  const availableDevices = [
    { id: 'DEV-2026-0451', model: 'Dell XPS 13', serialNo: 'DXP-2026-0451', status: 'Ready' },
    { id: 'DEV-2026-0452', model: 'ThinkPad X1 Carbon', serialNo: 'TPC-2026-0452', status: 'Ready' },
    { id: 'DEV-2026-0453', model: 'MacBook Pro 14"', serialNo: 'MBP-2026-0453', status: 'Ready' },
  ];

  // Focus management + Escape to close (accessibility)
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleAssignDevice = async () => {
    if (!selectedDeviceId) {
      toast.info('Please select a device to assign.');
      return;
    }

    setCompleting(true);
    try {
      // TODO: Call device assignment API when implemented
      // const device = availableDevices.find(d => d.id === selectedDeviceId);
      // await api.assignDevice(device.id, { ticketCode, ... });

      // For now, simulate the completion
      await new Promise((resolve) => setTimeout(resolve, 800));

      await onComplete();
      toast.success(`Device ${selectedDeviceId} assigned to ${ticketCode}.`);
    } catch (err) {
      toast.error('Failed to assign device. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-assign-title"
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
            aria-label="Close device assignment"
            className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <h3 id="device-assign-title" className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight text-center">
            Assign Device to {ticketCode}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed">
            Select an available device from inventory to complete this hardware request.
          </p>

          <div className="mt-6 space-y-2">
            <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-2 font-mono">
              Available Devices
            </label>
            <div className="space-y-2">
              {availableDevices.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No devices available in inventory.
                </div>
              ) : (
                availableDevices.map((device) => (
                  <label key={device.id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="device"
                      value={device.id}
                      checked={selectedDeviceId === device.id}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">
                        {device.model}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div>Serial: <span className="font-mono">{device.serialNo}</span></div>
                        <div>Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{device.status}</span></div>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
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
            onClick={handleAssignDevice}
            disabled={!selectedDeviceId || completing || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            {completing || isLoading ? (
              <Spinner label="Assigning…" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Assign & Resolve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
