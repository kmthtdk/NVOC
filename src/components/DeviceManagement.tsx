import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle } from 'lucide-react';
import { api, ApiError, getAuthToken } from '../api/client';
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

interface DeviceManagementProps {
  user?: { role: string };
}

export default function DeviceManagement({ user }: DeviceManagementProps) {
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
      'In Stock': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
      'Active': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'In Repair': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
      'Retired': 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300',
      'Lost': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Device Inventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage IT devices and track assignments</p>
        </div>
        <button
          onClick={() => setShowFormModal(true)}
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Code</th>
                <th className="px-6 py-3 text-left font-semibold">Model</th>
                <th className="px-6 py-3 text-left font-semibold">Serial</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Assigned To</th>
                <th className="px-6 py-3 text-left font-semibold">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No devices found
                  </td>
                </tr>
              ) : (
                filtered.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">{device.code}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{device.model}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600 dark:text-gray-400">{device.serialNumber}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{device.assignedTo || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{device.department || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
            Showing {filtered.length} of {devices.length} devices
          </div>
        </div>
      )}

      {showFormModal && (
        <DeviceFormModal
          onClose={() => setShowFormModal(false)}
          onSaved={handleDeviceSaved}
          authToken={getAuthToken() || undefined}
        />
      )}
    </div>
  );
}
