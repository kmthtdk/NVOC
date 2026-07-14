import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import DeviceFormModal from './DeviceFormModal';
import UnresolvedCustody from './UnresolvedCustody';

interface Device {
  id: number;
  code: string;
  assetCode: string | null;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: string;
  assignedTo: string | null;
  department: string | null;
}

export default function DeviceManagement() {
  const toast = useToast();
  // Seeded from ?q= so the command bar can hand a device straight to this list
  // instead of dropping you on an unfiltered inventory and wishing you luck.
  const [searchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFormModal, setShowFormModal] = useState(false);

  // The initial state above only runs on mount. Searching from the command bar
  // while already on this page changes the URL without remounting, so without
  // this the list would sit there ignoring the term you just picked.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const result = await api.listDevices();
        setDevices(result.data || []);
        setError(null);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Failed to load devices';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, [toast]);

  const filtered = devices.filter((d) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      d.code.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      // The asset tag is what is physically printed on the machine, so it is the
      // string somebody standing next to it will actually type.
      (d.assetCode?.toLowerCase().includes(q) ?? false);
    const matchesStatus = !filterStatus || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'In Stock': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      'Active': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'In Repair': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      'Retired': 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300',
      'Lost': 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const handleDeviceSaved = async () => {
    setShowFormModal(false);
    // Reload devices
    try {
      const result = await api.listDevices();
      setDevices(result.data || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load devices';
      toast.error(msg);
    }
  };

  // Memoize callbacks to prevent re-creation on every render from parent clock tick
  const handleCloseModal = useCallback(() => setShowFormModal(false), []);
  const handleOpenModal = useCallback(() => setShowFormModal(true), []);

  return (
    <div className="space-y-6">
      {/* The page title lives in the shell's PageHeader now; keeping one here too
          printed "Device Inventory" twice, once in each type scale. */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Custody the backfill could not resolve. Renders nothing once it is clean. */}
      <UnresolvedCustody />

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by code, asset code, model, or serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Active">Active</option>
          <option value="In Repair">In Repair</option>
          <option value="Retired">Retired</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-rose-800 dark:text-rose-300">Error</h3>
            <p className="text-rose-700 dark:text-rose-400 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          {/* A wide table on a phone scrolls inside its own box — the page body
              must never scroll sideways. `data-table` carries the zebra, the 2px
              header rule and the 8px row padding the spec asks for. */}
          <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-6 text-left font-semibold">Code</th>
                <th className="px-6 text-left font-semibold">Asset Code</th>
                <th className="px-6 text-left font-semibold">Model</th>
                <th className="px-6 text-left font-semibold">Serial</th>
                <th className="px-6 text-left font-semibold">Status</th>
                <th className="px-6 text-left font-semibold">Assigned To</th>
                <th className="px-6 text-left font-semibold">Department</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No devices found
                  </td>
                </tr>
              ) : (
                filtered.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/70">
                    <td className="px-6 py-2 font-mono font-bold text-slate-900 dark:text-white">{device.code}</td>
                    <td className="px-6 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{device.assetCode || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                    <td className="px-6 py-2 text-slate-900 dark:text-white">{device.model}</td>
                    <td className="px-6 py-2 text-xs font-mono text-slate-600 dark:text-slate-400">{device.serialNumber}</td>
                    <td className="px-6 py-2">
                      <span className={`px-3 py-1 rounded-sm text-xs font-semibold ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-slate-600 dark:text-slate-400">{device.assignedTo || '-'}</td>
                    <td className="px-6 py-2 text-slate-600 dark:text-slate-400">{device.department || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <div className="surface-header border-b-0 border-t px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
            Showing {filtered.length} of {devices.length} devices
          </div>
        </div>
      )}

      {showFormModal && (
        <DeviceFormModal onClose={handleCloseModal} onSaved={handleDeviceSaved} />
      )}
    </div>
  );
}
