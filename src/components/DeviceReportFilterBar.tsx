import React from 'react';
import { X } from 'lucide-react';
import { DeviceReportFilters } from '../api/client';

interface DeviceReportFilterBarProps {
  filters: DeviceReportFilters;
  onChange: (filters: DeviceReportFilters) => void;
  departmentOptions: string[];
  deviceTypeOptions: string[];
}

export default function DeviceReportFilterBar({
  filters,
  onChange,
  departmentOptions,
  deviceTypeOptions,
}: DeviceReportFilterBarProps) {
  const statusOptions = ['Active', 'In Repair', 'In Stock', 'Retired', 'Lost'];

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  const handleFilterChange = (field: keyof DeviceReportFilters, value: string) => {
    onChange({
      ...filters,
      [field]: value === '' ? undefined : value,
    });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Filter Reports</h3>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Department */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Department
            </label>
            <select
              value={filters.department || ''}
              onChange={e => handleFilterChange('department', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departmentOptions.map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Device Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Device Type
            </label>
            <select
              value={filters.deviceType || ''}
              onChange={e => handleFilterChange('deviceType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Device Types</option>
              {deviceTypeOptions.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Showing filtered results
            {filters.department && ` • Department: ${filters.department}`}
            {filters.deviceType && ` • Type: ${filters.deviceType}`}
            {filters.status && ` • Status: ${filters.status}`}
          </div>
        )}
      </div>
    </div>
  );
}
