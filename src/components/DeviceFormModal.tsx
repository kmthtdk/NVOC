// ============================================================================
// DeviceFormModal — add / edit a device in the IT inventory.
// VOC-native version: aligned to the backend `devices` contract
// (POST /api/devices, PUT /api/devices/:id). The asset code (ITA-YYYY-NNNN)
// is generated server-side, so it is read-only here.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { X, Save } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';

export type DeviceStatus = 'Active' | 'In Repair' | 'Retired' | 'Lost';

export interface Device {
  id: number;
  code: string;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: DeviceStatus;
  assignedTo: string | null;
  department: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface DeviceFormModalProps {
  /** Device to edit; omit/undefined for create mode. */
  device?: Device | null;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: (device: Device) => void;
  /** Optional API base; defaults to relative /api (same-origin via nginx proxy). */
  apiBaseUrl?: string;
  /** Bearer token for the request. */
  authToken?: string;
}

const DEVICE_TYPE_OPTIONS = [
  'desktop',
  'laptop',
  'monitor',
  'phone',
  'tablet',
  'deskphone',
  'removable_disk',
  'accessories',
];

const STATUS_OPTIONS: DeviceStatus[] = ['Active', 'In Repair', 'Retired', 'Lost'];

interface FormState {
  deviceType: string;
  model: string;
  serialNumber: string;
  status: DeviceStatus;
  assignedTo: string;
  department: string;
  purchaseDate: string;
  warrantyExpiry: string;
  notes: string;
}

function toFormState(device?: Device | null): FormState {
  return {
    deviceType: device?.deviceType ?? 'laptop',
    model: device?.model ?? '',
    serialNumber: device?.serialNumber ?? '',
    status: device?.status ?? 'Active',
    assignedTo: device?.assignedTo ?? '',
    department: device?.department ?? '',
    purchaseDate: device?.purchaseDate ?? '',
    warrantyExpiry: device?.warrantyExpiry ?? '',
    notes: device?.notes ?? '',
  };
}

export default function DeviceFormModal({
  device,
  onClose,
  onSaved,
  apiBaseUrl = '/api',
  authToken = '',
}: DeviceFormModalProps) {
  const toast = useToast();
  const isEditMode = !!device?.id;
  const closeRef = useRef<HTMLButtonElement>(null);

  const [form, setForm] = useState<FormState>(() => toFormState(device));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toFormState(device));
    setErrors({});
  }, [device]);

  // Focus management + Escape to close (accessibility).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.deviceType.trim()) next.deviceType = 'Device type is required';
    if (!form.model.trim()) next.model = 'Model is required';
    if (!form.serialNumber.trim()) next.serialNumber = 'Serial number is required';
    if (!STATUS_OPTIONS.includes(form.status)) next.status = 'Invalid status';
    const dateOk = (v: string) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!dateOk(form.purchaseDate)) next.purchaseDate = 'Use format YYYY-MM-DD';
    if (!dateOk(form.warrantyExpiry)) next.warrantyExpiry = 'Use format YYYY-MM-DD';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.info('Please fix the highlighted fields.');
      return;
    }

    const payload = {
      deviceType: form.deviceType.trim(),
      model: form.model.trim(),
      serialNumber: form.serialNumber.trim(),
      status: form.status,
      assignedTo: form.assignedTo.trim() || null,
      department: form.department.trim() || null,
      purchaseDate: form.purchaseDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    try {
      const url = isEditMode
        ? `${apiBaseUrl}/devices/${device!.id}`
        : `${apiBaseUrl}/devices`;
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Request failed (${res.status})`);
      }

      const body = await res.json();
      const saved: Device = body.data ?? body;
      toast.success(isEditMode ? 'Device updated.' : `Device ${saved.code ?? ''} created.`);
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save device.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 ` +
    `text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ` +
    (errors[field] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-form-title"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 id="device-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Device' : 'Add Device'}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {isEditMode && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Asset Code
              </label>
              <input
                type="text"
                value={device?.code ?? ''}
                readOnly
                className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">Generated automatically by the system.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Device Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.deviceType}
                onChange={(e) => update('deviceType', e.target.value)}
                className={fieldClass('deviceType')}
              >
                {DEVICE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.deviceType && <p className="mt-1 text-xs text-red-500">{errors.deviceType}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className={fieldClass('status')}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.status && <p className="mt-1 text-xs text-red-500">{errors.status}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                className={fieldClass('model')}
                placeholder="Dell Latitude 7440"
              />
              {errors.model && <p className="mt-1 text-xs text-red-500">{errors.model}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => update('serialNumber', e.target.value)}
                className={fieldClass('serialNumber')}
                placeholder="SN-XXXX-0000"
              />
              {errors.serialNumber && (
                <p className="mt-1 text-xs text-red-500">{errors.serialNumber}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Assigned To
              </label>
              <input
                type="text"
                value={form.assignedTo}
                onChange={(e) => update('assignedTo', e.target.value)}
                className={fieldClass('assignedTo')}
                placeholder="(unassigned)"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Department
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                className={fieldClass('department')}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Purchase Date
              </label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => update('purchaseDate', e.target.value)}
                className={fieldClass('purchaseDate')}
              />
              {errors.purchaseDate && (
                <p className="mt-1 text-xs text-red-500">{errors.purchaseDate}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Warranty Expiry
              </label>
              <input
                type="date"
                value={form.warrantyExpiry}
                onChange={(e) => update('warrantyExpiry', e.target.value)}
                className={fieldClass('warrantyExpiry')}
              />
              {errors.warrantyExpiry && (
                <p className="mt-1 text-xs text-red-500">{errors.warrantyExpiry}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className={fieldClass('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Spinner /> : <Save className="h-4 w-4" />}
              {isEditMode ? 'Save Changes' : 'Create Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
