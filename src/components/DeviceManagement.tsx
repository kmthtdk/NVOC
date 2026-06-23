'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Ticket,
  Filter,
  X,
} from 'lucide-react';

// Types
interface Device {
  id: number;
  name: string;
  category: 'IT equipment' | 'Network equipment' | 'Server equipment';
  sub_type: string;
  status: 'Active' | 'In Repair' | 'Retired' | 'Lost';
  assigned_to: string;
  department: string;
  purchase_date: string;
  warranty_expiry: string;
  serial_number: string;
  notes: string;
  voc_tickets?: number;
  created_at?: string;
  updated_at?: string;
}

interface FilterState {
  type: string;
  status: string;
  assignedTo: string;
  department: string;
  searchQuery: string;
}

interface User {
  role: 'admin' | 'it_staff' | 'viewer';
}

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<Device['status'], { bg: string; text: string; badge: string }> = {
  'Active': { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', badge: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' },
  'In Repair': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' },
  'Retired': { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', badge: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200' },
  'Lost': { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' },
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'IT equipment', label: 'IT Equipment' },
  { value: 'Network equipment', label: 'Network Equipment' },
  { value: 'Server equipment', label: 'Server Equipment' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'Active', label: 'Active' },
  { value: 'In Repair', label: 'In Repair' },
  { value: 'Retired', label: 'Retired' },
  { value: 'Lost', label: 'Lost' },
];

export default function DeviceManagement({ user, devices: initialDevices = [] }: { user?: User; devices?: Device[] }) {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    type: '',
    status: '',
    assignedTo: '',
    department: '',
    searchQuery: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [showModal, setShowModal] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Extract unique values for filters
  const uniqueAssignees = useMemo(
    () => [...new Set(devices.map(d => d.assigned_to))].filter(Boolean).sort(),
    [devices]
  );

  const uniqueDepartments = useMemo(
    () => [...new Set(devices.map(d => d.department))].filter(Boolean).sort(),
    [devices]
  );

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchesCategory = !filters.type || device.category === filters.type;
      const matchesStatus = !filters.status || device.status === filters.status;
      const matchesAssignee = !filters.assignedTo || device.assigned_to === filters.assignedTo;
      const matchesDepartment = !filters.department || device.department === filters.department;
      const matchesSearch = !filters.searchQuery ||
        device.serial_number.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        device.name.toLowerCase().includes(filters.searchQuery.toLowerCase());

      return matchesCategory && matchesStatus && matchesAssignee && matchesDepartment && matchesSearch;
    });
  }, [devices, filters]);

  // Paginated devices
  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDevices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDevices, currentPage]);

  const totalPages = Math.ceil(filteredDevices.length / ITEMS_PER_PAGE);

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      assignedTo: '',
      department: '',
      searchQuery: '',
    });
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCSV = useCallback(() => {
    if (filteredDevices.length === 0) {
      alert('No devices to export');
      return;
    }

    const headers = ['ID', 'Name', 'Category', 'Sub Type', 'Status', 'Assigned To', 'Department', 'Serial Number', 'Purchase Date', 'Warranty Expiry'];
    const rows = filteredDevices.map(device => [
      device.id,
      device.name,
      device.category,
      device.sub_type,
      device.status,
      device.assigned_to,
      device.department,
      device.serial_number,
      device.purchase_date,
      device.warranty_expiry,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [filteredDevices]);

  // CSV Import
  const handleImportCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const newDevices: Device[] = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const device: Device = {
            id: devices.length + i,
            name: values[headers.indexOf('name')] || '',
            category: (values[headers.indexOf('category')] || 'IT equipment') as Device['category'],
            sub_type: values[headers.indexOf('sub type')] || '',
            status: (values[headers.indexOf('status')] || 'Active') as Device['status'],
            assigned_to: values[headers.indexOf('assigned to')] || '',
            department: values[headers.indexOf('department')] || '',
            purchase_date: values[headers.indexOf('purchase date')] || '',
            warranty_expiry: values[headers.indexOf('warranty expiry')] || '',
            serial_number: values[headers.indexOf('serial number')] || '',
            notes: '',
          };

          newDevices.push(device);
        }

        setDevices(prev => [...prev, ...newDevices]);
        alert(`Successfully imported ${newDevices.length} devices`);
      } catch (error) {
        alert('Error importing CSV. Please check the file format.');
        console.error(error);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  }, [devices.length]);

  // Handle add/edit
  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      setDevices(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleSaveDevice = (device: Device) => {
    if (editingDevice) {
      setDevices(prev => prev.map(d => (d.id === device.id ? device : d)));
    } else {
      const newDevice = { ...device, id: Math.max(...devices.map(d => d.id), 0) + 1 };
      setDevices(prev => [...prev, newDevice]);
    }
    setShowModal(false);
    setEditingDevice(null);
  };

  // Access control
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            Device management is only available to administrators. Please contact your IT manager for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Device Inventory</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage IT equipment, network devices, and servers</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Add Device
              </button>
              <label className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by serial number or device name..."
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                showFilters
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <select
                value={filters.assignedTo}
                onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Assignees</option>
                {uniqueAssignees.map(assignee => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>

              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>
          )}

          {/* Results Summary */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {paginatedDevices.length} of {filteredDevices.length} devices
            {Object.values(filters).some(v => v) && ' (filtered)'}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Device Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Serial Number</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Assigned To</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Department</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Warranty</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">VOC Tickets</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.length > 0 ? (
                  paginatedDevices.map(device => (
                    <tr
                      key={device.id}
                      className={`border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${
                        STATUS_COLORS[device.status].bg
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{device.sub_type}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                          {device.serial_number}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{device.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[device.status].badge}`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{device.assigned_to || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{device.department || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{device.warranty_expiry}</span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href="#"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          <Ticket className="w-4 h-4" />
                          <span className="text-sm">{device.voc_tickets || 0}</span>
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(device)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                            title="Edit device"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(device.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                            title="Delete device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No devices found. Try adjusting your filters or add a new device.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <DeviceModal
            device={editingDevice}
            onSave={handleSaveDevice}
            onClose={() => {
              setShowModal(false);
              setEditingDevice(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Device Modal Component
function DeviceModal({
  device,
  onSave,
  onClose,
}: {
  device: Device | null;
  onSave: (device: Device) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Device>(
    device || {
      id: 0,
      name: '',
      category: 'IT equipment',
      sub_type: '',
      status: 'Active',
      assigned_to: '',
      department: '',
      purchase_date: '',
      warranty_expiry: '',
      serial_number: '',
      notes: '',
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.serial_number.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {device ? 'Edit Device' : 'Add New Device'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Device Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Dell Latitude 5520"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Serial Number *
            </label>
            <input
              type="text"
              name="serial_number"
              value={formData.serial_number}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., SN-001-DELL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="IT equipment">IT Equipment</option>
              <option value="Network equipment">Network Equipment</option>
              <option value="Server equipment">Server Equipment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sub Type
            </label>
            <input
              type="text"
              name="sub_type"
              value={formData.sub_type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Laptop, Server, Switch"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="In Repair">In Repair</option>
              <option value="Retired">Retired</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assigned To
            </label>
            <input
              type="text"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Department
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., IT, Finance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purchase Date
            </label>
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Warranty Expiry
            </label>
            <input
              type="date"
              name="warranty_expiry"
              value={formData.warranty_expiry}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="md:col-span-2 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-800 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              {device ? 'Update Device' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
