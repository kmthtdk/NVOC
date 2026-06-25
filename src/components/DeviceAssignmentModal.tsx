// ============================================================================
// DeviceAssignmentModal — Hardware assignment workflow for new device requests.
// Triggered when a hardware_request ticket is resolved with deviceActionType='new'.
// User selects/confirms device inventory allocation, then onComplete triggers
// device update + ticket resolution.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, Package, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../api/client';
import { Spinner } from './ui/Spinner';

interface Device {
  id: number;
  code: string;
  model: string;
  serialNumber: string;
  status: string;
  deviceType: string;
}

interface DeviceAssignmentModalProps {
  ticketCode: string;
  ticketId?: string | number;
  ticketDescription?: string;
  deviceType?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterDept?: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeviceAssignmentModal({
  ticketCode,
  ticketId,
  ticketDescription,
  deviceType,
  requesterName = 'Employee',
  requesterEmail = 'employee@company.com',
  requesterDept,
  onComplete,
  onCancel,
  isLoading = false,
}: DeviceAssignmentModalProps) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);

  // Fetch available devices (only "In Stock" status + matching deviceType if specified)
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Only fetch devices with "In Stock" status - devices available for assignment
        const result = await api.listAvailableDevices();
        let devices = result.data || [];

        // Filter by deviceType if specified
        if (deviceType) {
          devices = devices.filter((d: Device) =>
            d.deviceType?.toLowerCase() === deviceType.toLowerCase()
          );
        }

        setAvailableDevices(devices);
        if (devices.length > 0) {
          setSelectedDeviceId(devices[0].id);
        }
      } catch (err) {
        toast.error('Failed to load available devices');
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, [toast, deviceType]);

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
      const selected = availableDevices.find((d) => d.id === selectedDeviceId);
      if (!selected) {
        toast.error('Device not found');
        return;
      }

      // Assign device to requester with reason and ticket tracking
      const reason = ticketDescription || `Assigned via ${ticketCode}`;
      await api.assignDevice(selectedDeviceId, requesterName, requesterEmail, requesterDept, ticketId, reason);

      // Create ticket-device link if ticketId provided
      if (ticketId) {
        try {
          await api.createDeviceLink(ticketId.toString(), selectedDeviceId, 'new');
        } catch (linkErr) {
          // Log but don't block on link creation failure
          console.error('Failed to create device link:', linkErr);
        }
      }

      await onComplete();
      const deviceCode = selected.code || `Device #${selectedDeviceId}`;
      toast.success(`${deviceCode} assigned to ${requesterName}.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to assign device';
      toast.error(msg);
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
            Assign Device — {ticketCode}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed">
            Select an available device for <strong>{requesterName}</strong>
            {requesterDept && <> from {requesterDept}</>}
          </p>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg text-blue-700 dark:text-blue-300 text-xs">
            <strong>Device Status:</strong> Only devices with "In Stock" status can be assigned. Once assigned, status changes to "Active".
          </div>

          <div className="mt-6 space-y-2">
            <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-2 font-mono">
              Available Devices (In Stock)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-6">
                  <Spinner label="Loading devices…" />
                </div>
              ) : availableDevices.length === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <div>
                      <strong>No devices available</strong>
                      <p className="mt-1">All devices are currently assigned. Check if any can be returned to inventory.</p>
                    </div>
                  </div>
                </div>
              ) : (
                availableDevices.map((device) => (
                  <label
                    key={device.id}
                    className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="device"
                      value={device.id}
                      checked={selectedDeviceId === device.id}
                      onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                      className="mt-1.5 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">
                        {device.model}
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 ml-2">
                          {device.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 mt-1">
                        <div>Serial: <span className="font-mono text-slate-700 dark:text-slate-300">{device.serialNumber || 'N/A'}</span></div>
                        <div className="flex justify-between">
                          <span>Type: <span className="capitalize font-medium">{device.deviceType}</span></span>
                          <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 rounded text-[10px] font-semibold">
                            In Stock
                          </span>
                        </div>
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
            disabled={!selectedDeviceId || completing || isLoading || availableDevices.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xs transition-colors cursor-pointer"
            title={availableDevices.length === 0 ? 'No devices available' : 'Assign device to employee'}
          >
            {completing || isLoading ? (
              <Spinner label="Assigning…" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Assign Device
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
