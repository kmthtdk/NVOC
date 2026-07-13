import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import DeviceFormModal from './DeviceFormModal';

interface Device {
  id: number;
  code: string;
  deviceType: string;
  model: string;
  serialNumber: string;
  status: string;
  assignedTo: string | null;
  department: string | null;
}

export default function DeviceManagement() {
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFormModal, setShowFormModal] = useState(false);

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
    const matchesSearch = d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'In Stock': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      'Active': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'In Repair': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
      'Retired': 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300',
      'Lost': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Device Inventory</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage IT devices and track assignments</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by code, model, or serial..."
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
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-300">Error</h3>
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Code</th>
                <th className="px-6 py-3 text-left font-semibold">Model</th>
                <th className="px-6 py-3 text-left font-semibold">Serial</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Assigned To</th>
                <th className="px-6 py-3 text-left font-semibold">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No devices found
                  </td>
                </tr>
              ) : (
                filtered.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">{device.code}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white">{device.model}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">{device.serialNumber}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{device.assignedTo || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{device.department || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
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
