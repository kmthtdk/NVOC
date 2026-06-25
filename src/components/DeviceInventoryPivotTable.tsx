import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { api, DeviceReportFilters } from '../api/client';

interface Device {
  id: number;
  code: string;
  deviceType: string;
  status: string;
  department: string | null;
  assignedTo: string | null;
  model: string;
}

interface DeviceInventoryPivotTableProps {
  filters: DeviceReportFilters;
}

export default function DeviceInventoryPivotTable({ filters }: DeviceInventoryPivotTableProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        // Backend caps pageSize at 100, so paginate until all devices are loaded
        const allDevices: Device[] = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore) {
          const res = await api.listDevices(page, pageSize, filters);
          const batch = res.data || [];
          allDevices.push(...batch);
          hasMore = batch.length === pageSize && allDevices.length < res.total;
          page += 1;
        }

        setDevices(allDevices);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load devices');
      } finally {
        setLoading(false);
      }
    };
    loadDevices();
  }, [filters]);

  const pivotData = useMemo(() => {
    if (!devices.length) return null;

    // Pivot 1: Department × Device Type
    const deptType: Record<string, Record<string, number>> = {};
    const allDepts = new Set<string>();
    const allTypes = new Set<string>();

    for (const d of devices) {
      const dept = d.department || 'Unassigned';
      const dtype = d.deviceType || 'unknown';
      if (!deptType[dept]) deptType[dept] = {};
      deptType[dept][dtype] = (deptType[dept][dtype] || 0) + 1;
      allDepts.add(dept);
      allTypes.add(dtype);
    }

    // Pivot 2: Department × Device Status
    const deptStatus: Record<string, Record<string, number>> = {};
    const allStatuses = new Set<string>();

    for (const d of devices) {
      const dept = d.department || 'Unassigned';
      const status = d.status || 'unknown';
      if (!deptStatus[dept]) deptStatus[dept] = {};
      deptStatus[dept][status] = (deptStatus[dept][status] || 0) + 1;
      allStatuses.add(status);
    }

    return {
      deptType,
      allDepts: Array.from(allDepts).sort(),
      allTypes: Array.from(allTypes).sort(),
      deptStatus,
      allStatuses: Array.from(allStatuses).sort(),
      total: devices.length,
    };
  }, [devices]);

  const metrics = useMemo(() => {
    const active = devices.filter(d => d.status === 'Active').length;
    const inStock = devices.filter(d => d.status === 'In Stock').length;
    const inRepair = devices.filter(d => d.status === 'In Repair').length;
    const utilization = devices.length > 0 ? Math.round((active / devices.length) * 100) : 0;
    return { active, inStock, inRepair, utilization };
  }, [devices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex rounded-full bg-slate-100 p-3 mb-3">
            <BarChart3 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading device inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900 dark:text-red-300">Error Loading Reports</h3>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!pivotData) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-slate-600 dark:text-slate-400">No device data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Total Devices</div>
          <div className="text-3xl font-bold text-slate-950 dark:text-white">{pivotData.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Active</div>
          <div className="text-3xl font-bold text-emerald-600">{metrics.active}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">In Stock</div>
          <div className="text-3xl font-bold text-sky-600">{metrics.inStock}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Utilization</div>
          <div className="text-3xl font-bold text-violet-600">{metrics.utilization}%</div>
        </div>
      </div>

      {/* Pivot Table 1: Department × Device Type */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-600" />
            Department × Device Type
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Department</th>
              {pivotData.allTypes.map(type => (
                <th key={type} className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                  {type}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pivotData.allDepts.map(dept => (
              <tr key={dept} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{dept}</td>
                {pivotData.allTypes.map(type => (
                  <td key={type} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                    {pivotData.deptType[dept]?.[type] || 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/50">
                  {pivotData.allTypes.reduce((sum, type) => sum + (pivotData.deptType[dept]?.[type] || 0), 0)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 dark:bg-slate-800/50 border-t-2 border-slate-300 dark:border-slate-600">
              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">Total</td>
              {pivotData.allTypes.map(type => (
                <td key={type} className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {pivotData.allDepts.reduce((sum, dept) => sum + (pivotData.deptType[dept]?.[type] || 0), 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{pivotData.total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pivot Table 2: Department × Device Status */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-600" />
            Department × Device Status
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Department</th>
              {pivotData.allStatuses.map(status => (
                <th key={status} className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                  {status}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pivotData.allDepts.map(dept => (
              <tr key={dept} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{dept}</td>
                {pivotData.allStatuses.map(status => (
                  <td key={status} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                    {pivotData.deptStatus[dept]?.[status] || 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/50">
                  {pivotData.allStatuses.reduce((sum, status) => sum + (pivotData.deptStatus[dept]?.[status] || 0), 0)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 dark:bg-slate-800/50 border-t-2 border-slate-300 dark:border-slate-600">
              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">Total</td>
              {pivotData.allStatuses.map(status => (
                <td key={status} className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {pivotData.allDepts.reduce((sum, dept) => sum + (pivotData.deptStatus[dept]?.[status] || 0), 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{pivotData.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
