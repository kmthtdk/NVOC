import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, TrendingUp, Clock, ListTodo } from 'lucide-react';
import { api } from '../api/client';

interface PendingRequest {
  id: string;
  code: string;
  title: string;
  created_at: string;
  priority: string;
  requester_name: string;
  assigned_to: string;
  status: string;
}

interface FulfillmentStat {
  category_id: string;
  total_resolved: number;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
}

interface AgeBucket {
  [key: string]: Record<string, number>;
}

interface CategoryTrend {
  month: string;
  category_id: string;
  count: number;
}

type TabType = 'pending-hardware' | 'fulfillment' | 'age-buckets' | 'category-trend';

export default function TicketReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending-hardware');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [fulfillmentStats, setFulfillmentStats] = useState<FulfillmentStat[]>([]);
  const [ageBuckets, setAgeBuckets] = useState<AgeBucket>({});
  const [categoryTrend, setCategoryTrend] = useState<CategoryTrend[]>([]);

  const loadReport = async (tab: TabType) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'pending-hardware': {
          const res = await api.getPendingHardwareReport();
          setPendingRequests(res.pendingRequests || []);
          break;
        }
        case 'fulfillment': {
          const res = await api.getFulfillmentTimeReport();
          setFulfillmentStats(res.fulfillmentStats || []);
          break;
        }
        case 'age-buckets': {
          const res = await api.getAgeBucketsReport();
          setAgeBuckets(res.ageBuckets || {});
          break;
        }
        case 'category-trend': {
          const res = await api.getCategoryTrendReport();
          setCategoryTrend(res.categoryTrend || []);
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
    loadReport(activeTab);
  }, [activeTab]);

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          Ticket Analytics Reports
        </h1>
        <p className="text-gray-600 mt-2">Hardware requests, fulfillment times, and ticket aging analysis</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        {[
          { id: 'pending-hardware', label: 'Pending Hardware', icon: ListTodo },
          { id: 'fulfillment', label: 'Fulfillment Time', icon: Clock },
          { id: 'age-buckets', label: 'Ticket Age', icon: TrendingUp },
          { id: 'category-trend', label: 'Category Trends', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
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
        <div className="p-8 text-center">
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
        <>
          {/* Pending Hardware Requests */}
          {activeTab === 'pending-hardware' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-blue-50 border-b border-gray-200 px-6 py-4">
                <h2 className="font-semibold text-gray-900">Open Hardware Requests ({pendingRequests.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Requester</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Priority</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                          No pending hardware requests
                        </td>
                      </tr>
                    ) : (
                      pendingRequests.map((req, idx) => (
                        <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-900">{req.code}</td>
                          <td className="px-4 py-3 text-gray-900">{req.title}</td>
                          <td className="px-4 py-3 text-gray-600">{req.requester_name}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              req.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                              req.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{req.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fulfillment Time */}
          {activeTab === 'fulfillment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fulfillmentStats.map((stat, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">{stat.category_id}</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-600 text-sm">Average Fulfillment</p>
                      <p className="text-2xl font-bold text-blue-600">{formatHours(stat.avg_hours)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Min - Max</p>
                      <p className="text-gray-900">{formatHours(stat.min_hours)} - {formatHours(stat.max_hours)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Resolved</p>
                      <p className="text-gray-900 font-semibold">{stat.total_resolved} tickets</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Age Buckets */}
          {activeTab === 'age-buckets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(ageBuckets).map(([bucket, statuses]) => (
                <div key={bucket} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">{bucket}</h3>
                  <div className="space-y-2">
                    {Object.entries(statuses).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">{status}</span>
                        <span className="font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Trend */}
          {activeTab === 'category-trend' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-blue-50 border-b border-gray-200 px-6 py-4">
                <h2 className="font-semibold text-gray-900">6-Month Category Trends</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Month</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Count</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryTrend.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      categoryTrend.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-900">{item.month}</td>
                          <td className="px-4 py-3 text-gray-900">{item.category_id}</td>
                          <td className="px-4 py-3 text-gray-900 font-semibold">{item.count}</td>
                          <td className="px-4 py-3">
                            <div className="w-24 bg-gray-200 rounded h-6 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full"
                                style={{ width: `${Math.min((item.count / 10) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
