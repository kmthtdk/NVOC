// ============================================================================
// DeviceFormModal — add / edit a device in the IT inventory.
// VOC-native version: aligned to the backend `devices` contract
// (POST /api/devices, PUT /api/devices/:id). The asset code (ITA-YYYY-NNNN)
// is generated server-side, so it is read-only here.
// MAC address management: new MACs included in POST body; existing MACs
// updated/deleted via dedicated endpoints (POST/PUT/DELETE /devices/:id/mac/:macId).
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { X, Save, Plus, Edit2, Trash2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';

export type DeviceStatus = 'Active' | 'In Repair' | 'Retired' | 'Lost';
export type MacAddressType = 'Ethernet' | 'WiFi' | 'Bluetooth' | 'Other';

export interface MacAddress {
  id: number;
  deviceId: number;
  macType: MacAddressType;
  macAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSpecifications {
  cpu?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  gpu?: string | null;
  psuWatts?: number | null;
  additionalSpecs?: Record<string, string> | null;
}

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
  macAddresses?: MacAddress[];
  specifications?: DeviceSpecifications;
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

const DEVICE_TYPE_LABELS: Record<string, string> = {
  'desktop': 'Desktop',
  'laptop': 'Laptop',
  'monitor': 'Monitor',
  'phone': 'Mobile Phone',
  'tablet': 'Tablet',
  'deskphone': 'Desk Phone',
  'removable_disk': 'Removable Disk',
  'accessories': 'Accessories',
};

const formatDeviceTypeLabel = (type: string): string => DEVICE_TYPE_LABELS[type] || type;

const STATUS_OPTIONS: DeviceStatus[] = ['Active', 'In Repair', 'Retired', 'Lost'];
const MAC_ADDRESS_TYPES: MacAddressType[] = ['Ethernet', 'WiFi', 'Bluetooth', 'Other'];
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

/** Internal state for MAC address management, tracking original vs new/edited state. */
interface MacAddressState extends Omit<MacAddress, 'deviceId' | 'createdAt' | 'updatedAt'> {
  /** Set if this is a new MAC being added (not persisted yet). */
  isNew?: boolean;
  /** Original values, set only for existing MACs that have been edited. */
  originalValues?: { macType: MacAddressType; macAddress: string };
}

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

interface MacAddressFormState {
  macType: MacAddressType;
  macAddress: string;
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

function isMacAddressValid(address: string): boolean {
  return MAC_ADDRESS_REGEX.test(address.trim());
}

function getMacStatus(mac: MacAddressState): 'new' | 'edited' | 'unchanged' {
  if (mac.isNew) return 'new';
  if (mac.originalValues) return 'edited';
  return 'unchanged';
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
  const [loading, setLoading] = useState(isEditMode);

  // MAC address management
  const [macAddresses, setMacAddresses] = useState<MacAddressState[]>(() =>
    device?.macAddresses?.map((mac) => ({
      id: mac.id,
      macType: mac.macType,
      macAddress: mac.macAddress,
    })) ?? [],
  );
  const [editingMacId, setEditingMacId] = useState<number | null>(null);
  const [editingMacForm, setEditingMacForm] = useState<MacAddressFormState>({
    macType: 'Ethernet',
    macAddress: '',
  });
  const [macErrors, setMacErrors] = useState<Record<string, string>>({});
  const [newMacForm, setNewMacForm] = useState<MacAddressFormState>({
    macType: 'Ethernet',
    macAddress: '',
  });
  const [newMacErrors, setNewMacErrors] = useState<Record<string, string>>({});
  const [showNewMacForm, setShowNewMacForm] = useState(false);

  // Device specifications management
  const [specifications, setSpecifications] = useState<DeviceSpecifications>(() =>
    device?.specifications ?? {}
  );
  const [specErrors, setSpecErrors] = useState<Record<string, string>>({});

  // Load full device data on mount (edit mode) to fetch MACs
  useEffect(() => {
    if (isEditMode && device?.id) {
      const loadDevice = async () => {
        try {
          const fullDevice: Device = await api.getDevice(device.id);
          setMacAddresses(
            fullDevice.macAddresses?.map((mac) => ({
              id: mac.id,
              macType: mac.macType,
              macAddress: mac.macAddress,
            })) ?? [],
          );
        } catch (err) {
          toast.error('Failed to load device details');
        } finally {
          setLoading(false);
        }
      };
      loadDevice();
    } else {
      setLoading(false);
    }
  }, [device?.id, isEditMode, toast]);

  useEffect(() => {
    setForm(toFormState(device));
    setErrors({});
  }, [device]);

  // Focus management on mount (accessibility) - run once only
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  // Escape to close - separate effect to prevent per-second re-runs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't close if user is dismissing a dropdown or typing in a field
      if (e.key === 'Escape' && e.defaultPrevented === false) {
        onClose();
      }
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

  // MAC Address Handlers
  const handleAddMacClick = () => {
    setNewMacForm({ macType: 'Ethernet', macAddress: '' });
    setNewMacErrors({});
    setShowNewMacForm(true);
  };

  const handleNewMacChange = (field: keyof MacAddressFormState, value: string) => {
    setNewMacForm((prev) => ({ ...prev, [field]: value }));
    if (newMacErrors[field]) {
      setNewMacErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateNewMac = (): boolean => {
    const next: Record<string, string> = {};
    if (!newMacForm.macAddress.trim()) {
      next.macAddress = 'MAC address is required';
    } else if (!isMacAddressValid(newMacForm.macAddress)) {
      next.macAddress = 'Invalid format. Use: 00:11:22:33:44:55';
    }
    setNewMacErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveNewMac = () => {
    if (!validateNewMac()) return;
    const tempId = Math.min(...macAddresses.map((m) => m.id ?? 0), 0) - 1;
    setMacAddresses((prev) => [
      ...prev,
      {
        id: tempId,
        macType: newMacForm.macType,
        macAddress: newMacForm.macAddress.trim(),
        isNew: true,
      },
    ]);
    setNewMacForm({ macType: 'Ethernet', macAddress: '' });
    setNewMacErrors({});
    setShowNewMacForm(false);
  };

  const handleEditMacClick = (mac: MacAddressState) => {
    setEditingMacId(mac.id);
    setEditingMacForm({
      macType: mac.macType,
      macAddress: mac.macAddress,
    });
    setMacErrors({});
  };

  const handleEditMacChange = (field: keyof MacAddressFormState, value: string) => {
    setEditingMacForm((prev) => ({ ...prev, [field]: value }));
    if (macErrors[field]) {
      setMacErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateEditMac = (): boolean => {
    const next: Record<string, string> = {};
    if (!editingMacForm.macAddress.trim()) {
      next.macAddress = 'MAC address is required';
    } else if (!isMacAddressValid(editingMacForm.macAddress)) {
      next.macAddress = 'Invalid format. Use: 00:11:22:33:44:55';
    }
    setMacErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveEditMac = () => {
    if (!validateEditMac()) return;
    setMacAddresses((prev) =>
      prev.map((m) =>
        m.id === editingMacId
          ? {
              ...m,
              macType: editingMacForm.macType,
              macAddress: editingMacForm.macAddress.trim(),
              ...(m.isNew
                ? { isNew: true }
                : {
                    originalValues: m.originalValues || {
                      macType: m.macType,
                      macAddress: m.macAddress,
                    },
                  }),
            }
          : m,
      ),
    );
    setEditingMacId(null);
  };

  const handleCancelEditMac = () => {
    setEditingMacId(null);
    setMacErrors({});
  };

  const handleDeleteMac = (id: number) => {
    setMacAddresses((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.info('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      // Step 1: Save or update the device itself
      const devicePayload = {
        deviceType: form.deviceType.trim(),
        model: form.model.trim(),
        serialNumber: form.serialNumber.trim(),
        status: form.status,
        assignedTo: form.assignedTo.trim() || null,
        department: form.department.trim() || null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpiry: form.warrantyExpiry || null,
        notes: form.notes.trim() || null,
        ...(isEditMode ? {} : { macAddresses: macAddresses.filter((m) => m.isNew) }),
        specifications: {
          cpu: specifications.cpu || null,
          ramGb: specifications.ramGb || null,
          storageGb: specifications.storageGb || null,
          gpu: specifications.gpu || null,
          psuWatts: specifications.psuWatts || null,
          additionalSpecs: specifications.additionalSpecs || null,
        },
      };

      let saved: Device;
      if (isEditMode) {
        saved = await api.updateDevice(device!.id, devicePayload);
      } else {
        saved = await api.createDevice(devicePayload);
      }
      // Ensure saved is a Device object (api may return { data: Device } or Device directly)
      if (saved && typeof saved === 'object' && 'data' in saved && !('id' in saved)) {
        saved = (saved as any).data;
      }

      // Step 2: For edit mode, handle MAC changes (add/edit/delete)
      if (isEditMode && device?.id) {
        for (const mac of macAddresses) {
          try {
            if (mac.isNew) {
              // Create new MAC
              await api.createMacAddress(device.id, {
                macType: mac.macType,
                macAddress: mac.macAddress,
              });
            } else if (mac.originalValues) {
              // Update existing MAC
              await api.updateMacAddress(device.id, mac.id, {
                macType: mac.macType,
                macAddress: mac.macAddress,
              });
            }
          } catch (macErr) {
            throw macErr;
          }
        }

        // Delete removed MACs
        const originalMacIds = new Set(device?.macAddresses?.map((m) => m.id) ?? []);
        const remainingMacIds = new Set(
          macAddresses
            .filter((m) => !m.isNew)
            .map((m) => m.id)
            .filter((id): id is number => typeof id === 'number'),
        );
        const deletedMacIds = Array.from(originalMacIds).filter((id) => !remainingMacIds.has(id));

        for (const deletedId of deletedMacIds) {
          try {
            await api.deleteMacAddress(device.id, deletedId);
          } catch (delErr) {
            throw delErr;
          }
        }

        // Refresh device to get updated MACs
        try {
          saved = await api.getDevice(device.id);
        } catch (err) {
          // Continue with the saved device even if refresh fails
        }
      }

      toast.success(isEditMode ? 'Device updated.' : `Device ${saved.code ?? ''} created.`);
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save device.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: string, customErrors?: Record<string, string>) => {
    const errMap = customErrors ?? errors;
    return (
      `w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 ` +
      `text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ` +
      (errMap[field] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600')
    );
  };

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
                <option value="">Select device type...</option>
                {DEVICE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {formatDeviceTypeLabel(t)}
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

          {/* MAC Address Management Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                MAC Addresses
              </h3>
              <button
                type="button"
                onClick={handleAddMacClick}
                disabled={saving || loading}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add MAC Address
              </button>
            </div>

            {/* Existing/Editing MAC Addresses List */}
            {macAddresses.length > 0 && (
              <div className="space-y-3 mb-4">
                {macAddresses.map((mac) => {
                  const status = getMacStatus(mac);
                  const isEditing = editingMacId === mac.id;

                  return (
                    <div
                      key={mac.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3"
                    >
                      {isEditing ? (
                        // Edit Mode
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                                Type
                              </label>
                              <select
                                value={editingMacForm.macType}
                                onChange={(e) =>
                                  handleEditMacChange('macType', e.target.value)
                                }
                                className={fieldClass('macType', macErrors)}
                              >
                                {MAC_ADDRESS_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                                Address
                              </label>
                              <input
                                type="text"
                                value={editingMacForm.macAddress}
                                onChange={(e) =>
                                  handleEditMacChange('macAddress', e.target.value)
                                }
                                placeholder="00:11:22:33:44:55"
                                className={fieldClass('macAddress', macErrors)}
                              />
                              {macErrors.macAddress && (
                                <p className="mt-1 text-xs text-red-500">
                                  {macErrors.macAddress}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={handleCancelEditMac}
                              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditMac}
                              className="rounded px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {mac.macAddress}
                              </span>
                              <span className="rounded bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                                {mac.macType}
                              </span>
                              {status === 'new' && (
                                <span className="inline-flex items-center gap-1 rounded bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                                  <CheckCircle className="h-3 w-3" />
                                  New
                                </span>
                              )}
                              {status === 'edited' && (
                                <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                                  <Clock className="h-3 w-3" />
                                  Edited
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditMacClick(mac)}
                              disabled={saving || loading}
                              className="rounded p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                              aria-label="Edit MAC address"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMac(mac.id)}
                              disabled={saving || loading}
                              className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              aria-label="Delete MAC address"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* New MAC Address Form */}
            {editingMacId === null && (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-3">
                {showNewMacForm || newMacForm.macAddress || Object.keys(newMacErrors).length > 0 ? (
                  // Form Visible
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Type
                        </label>
                        <select
                          value={newMacForm.macType}
                          onChange={(e) => handleNewMacChange('macType', e.target.value)}
                          className={fieldClass('macType', newMacErrors)}
                        >
                          {MAC_ADDRESS_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Address
                        </label>
                        <input
                          type="text"
                          value={newMacForm.macAddress}
                          onChange={(e) => handleNewMacChange('macAddress', e.target.value)}
                          placeholder="00:11:22:33:44:55"
                          className={fieldClass('macAddress', newMacErrors)}
                        />
                        {newMacErrors.macAddress && (
                          <p className="mt-1 text-xs text-red-500">{newMacErrors.macAddress}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setNewMacForm({ macType: 'Ethernet', macAddress: '' });
                          setNewMacErrors({});
                          setShowNewMacForm(false);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewMac}
                        className="rounded px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  // Empty State
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">No MAC addresses. Click "Add MAC Address" to add one.</p>
                  </div>
                )}
              </div>
            )}
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

          {/* Device Specifications Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Device Specifications</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* CPU */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CPU
                </label>
                <input
                  type="text"
                  value={specifications.cpu || ''}
                  onChange={(e) => setSpecifications({ ...specifications, cpu: e.target.value || null })}
                  placeholder="e.g., Intel i7-10700K"
                  disabled={isEditMode}
                  className={`rounded-md border border-gray-300 px-3 py-2 text-sm w-full ${isEditMode ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'}`}
                />
              </div>

              {/* RAM */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  RAM (GB)
                </label>
                <input
                  type="number"
                  value={specifications.ramGb || ''}
                  onChange={(e) => setSpecifications({ ...specifications, ramGb: e.target.value ? parseInt(e.target.value) : null })}
                  min="1"
                  max="1024"
                  placeholder="16"
                  disabled={isEditMode}
                  className={`rounded-md border border-gray-300 px-3 py-2 text-sm w-full ${isEditMode ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'}`}
                />
              </div>

              {/* Storage */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Storage (GB)
                </label>
                <input
                  type="number"
                  value={specifications.storageGb || ''}
                  onChange={(e) => setSpecifications({ ...specifications, storageGb: e.target.value ? parseInt(e.target.value) : null })}
                  min="1"
                  max="10000"
                  placeholder="512"
                  disabled={isEditMode}
                  className={`rounded-md border border-gray-300 px-3 py-2 text-sm w-full ${isEditMode ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'}`}
                />
              </div>

              {/* GPU */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  GPU (Optional)
                </label>
                <input
                  type="text"
                  value={specifications.gpu || ''}
                  onChange={(e) => setSpecifications({ ...specifications, gpu: e.target.value || null })}
                  placeholder="e.g., NVIDIA RTX 3060"
                  disabled={isEditMode}
                  className={`rounded-md border border-gray-300 px-3 py-2 text-sm w-full ${isEditMode ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'}`}
                />
              </div>

              {/* PSU */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  PSU Watts (Optional)
                </label>
                <input
                  type="number"
                  value={specifications.psuWatts || ''}
                  onChange={(e) => setSpecifications({ ...specifications, psuWatts: e.target.value ? parseInt(e.target.value) : null })}
                  min="0"
                  max="2000"
                  placeholder="130"
                  disabled={isEditMode}
                  className={`rounded-md border border-gray-300 px-3 py-2 text-sm w-full ${isEditMode ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'}`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || loading}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving || loading ? <Spinner /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
