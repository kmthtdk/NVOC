import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, TrendingUp, Users, Package, Clock } from 'lucide-react';
import { api, DeviceReportFilters } from '../api/client';
import DeviceInventoryPivotTable from './DeviceInventoryPivotTable';
import DeviceReportFilterBar from './DeviceReportFilterBar';

interface SummaryReport {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
}

interface AssignmentReport {
  device_code: string;
  model: string;
  serial_number: string;
  assigned_to: string | null;
  status: string;
  department: string | null;
}

interface AgingReport {
  device_code: string;
  model: string;
  assigned_to: string | null;
  warranty_expiry: string | null;
  days_until_expiry: number;
  status: string;
}

interface DepartmentReport {
  department: string;
  total: number;
  active: number;
  in_repair: number;
  retired: number;
}

interface AvailabilityReport {
  in_stock: number;
  active: number;
  in_repair: number;
  retired: number;
  lost: number;
}

type TabType = 'summary' | 'assignments' | 'aging' | 'department' | 'availability';

export default function DeviceReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DeviceReportFilters>({});
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [deviceTypeOptions, setDeviceTypeOptions] = useState<string[]>([]);

  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [assignments, setAssignments] = useState<AssignmentReport[]>([]);
  const [aging, setAging] = useState<AgingReport[]>([]);
  const [department, setDepartment] = useState<DepartmentReport[]>([]);
  const [availability, setAvailability] = useState<AvailabilityReport | null>(null);

  const loadReport = async (tab: TabType, activeFilters: DeviceReportFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'summary': {
          const res = await api.getDeviceSummary();
          setSummary(res.summary);
          // Extract department and device type options from summary
          setDepartmentOptions(Object.keys(res.summary.by_department).sort());
          setDeviceTypeOptions(Object.keys(res.summary.by_type).sort());
          break;
        }
        case 'assignments': {
          const res = await api.getDeviceAssignments(activeFilters);
          setAssignments(res.assignments || []);
          break;
        }
        case 'aging': {
          const res = await api.getDeviceAging(activeFilters);
          setAging(res.aging || []);
          break;
        }
        case 'department': {
          // Note: Pivot table component handles its own data fetching
          // This case doesn't need to load anything; the pivot table
          // renders directly and loads filtered device data
          break;
        }
        case 'availability': {
          const res = await api.getDeviceAvailability();
          setAvailability(res.availability);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeTab, filters);
  }, [activeTab, filters]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          Device Inventory Reports
        </h1>
        <p className="text-gray-600 mt-2">Comprehensive device tracking and allocation reports</p>
      </div>

      {/* Filter Bar */}
      <DeviceReportFilterBar
        filters={filters}
        onChange={setFilters}
        departmentOptions={departmentOptions}
        deviceTypeOptions={deviceTypeOptions}
      />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        {[
          { id: 'summary', label: 'Summary', icon: Package },
          { id: 'assignments', label: 'Assignments', icon: Users },
          { id: 'aging', label: 'Warranty Aging', icon: Clock },
          { id: 'department', label: 'By Department', icon: TrendingUp },
          { id: 'availability', label: 'Availability', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id as TabType)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="min-h-96 flex items-center justify-center p-8">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="text-gray-600">Loading report...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="transition-opacity duration-200">
          {/* Summary Tab */}
          {activeTab === 'summary' && summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Total Devices */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <p className="text-gray-500 text-sm font-medium">Total Devices</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{summary.total}</p>
              </div>

              {/* By Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <p className="text-gray-700 font-semibold mb-4">Status Breakdown</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(summary.by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <span className="text-gray-600">{status}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Type */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <p className="text-gray-700 font-semibold mb-4">Device Type</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(summary.by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-gray-600">{type}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Model</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Serial</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned To</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                          No devices assigned
                        </td>
                      </tr>
                    ) : (
                      assignments.map((device, idx) => (
                        <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-900">{device.device_code}</td>
                          <td className="px-4 py-3 text-gray-900">{device.model}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{device.serial_number}</td>
                          <td className="px-4 py-3 text-gray-900">{device.assigned_to || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{device.department || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {device.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aging Tab */}
          {activeTab === 'aging' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Model</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned To</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Warranty Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-gray-500">
                          No devices nearing warranty expiry
                        </td>
                      </tr>
                    ) : (
                      aging.map((device, idx) => (
                        <tr
                          key={idx}
                          className={`border-t border-gray-200 ${
                            device.days_until_expiry <= 30 ? 'bg-red-50' : device.days_until_expiry <= 60 ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-gray-900">{device.device_code}</td>
                          <td className="px-4 py-3 text-gray-900">{device.model}</td>
                          <td className="px-4 py-3 text-gray-600">{device.assigned_to || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{device.warranty_expiry || '-'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                device.days_until_expiry <= 30
                                  ? 'bg-red-100 text-red-700'
                                  : device.days_until_expiry <= 60
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {device.days_until_expiry} days
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Department Tab - Pivot Tables */}
          {activeTab === 'department' && (
            <DeviceInventoryPivotTable filters={filters} />
          )}

          {/* Availability Tab */}
          {activeTab === 'availability' && availability && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'In Stock', value: availability.in_stock, color: 'bg-blue-100 text-blue-700' },
                { label: 'Active', value: availability.active, color: 'bg-green-100 text-green-700' },
                { label: 'In Repair', value: availability.in_repair, color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Retired', value: availability.retired, color: 'bg-gray-100 text-gray-700' },
                { label: 'Lost', value: availability.lost, color: 'bg-red-100 text-red-700' },
              ].map((item, idx) => (
                <div key={idx} className={`rounded-lg p-6 ${item.color}`}>
                  <p className="text-sm font-medium opacity-90">{item.label}</p>
                  <p className="text-3xl font-bold mt-2">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
