import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, ListTodo } from 'lucide-react';
import { api } from '../api/client';
import { priorityBadge } from '../data/statusMeta';

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
      {/* Title comes from the shell's PageHeader — it was printed twice. */}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 flex-wrap">
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
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            <p className="text-slate-600 dark:text-slate-400">Loading report...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
          <p className="text-rose-800 dark:text-rose-300 font-medium">Error: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Pending Hardware Requests */}
          {activeTab === 'pending-hardware' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                <h2 className="font-semibold text-slate-900 dark:text-white">Open Hardware Requests ({pendingRequests.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Code</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Title</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Requester</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Created</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Priority</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-center text-slate-500 dark:text-slate-400">
                          No pending hardware requests
                        </td>
                      </tr>
                    ) : (
                      pendingRequests.map((req, idx) => (
                        <tr key={idx} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2 font-mono text-slate-900 dark:text-white">{req.code}</td>
                          <td className="px-4 py-2 text-slate-900 dark:text-white">{req.title}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{req.requester_name}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            {/* One priority vocabulary, from src/data/statusMeta.ts. The
                                inline map that used to live here had no `low` branch, so a
                                low-priority request rendered as a medium one. */}
                            <span className={`rounded-sm px-2 py-1 text-xs font-medium ${priorityBadge(req.priority)}`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{req.status}</td>
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
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{stat.category_id}</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Average Fulfillment</p>
                      <p className="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">{formatHours(stat.avg_hours)}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Min - Max</p>
                      <p className="text-slate-900 dark:text-white">{formatHours(stat.min_hours)} - {formatHours(stat.max_hours)}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Resolved</p>
                      <p className="text-slate-900 dark:text-white font-semibold">{stat.total_resolved} tickets</p>
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
                <div key={bucket} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{bucket}</h3>
                  <div className="space-y-2">
                    {Object.entries(statuses).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400 text-sm">{status}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Trend */}
          {activeTab === 'category-trend' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                <h2 className="font-semibold text-slate-900 dark:text-white">6-Month Category Trends</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Month</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Category</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Count</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryTrend.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-center text-slate-500 dark:text-slate-400">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      categoryTrend.map((item, idx) => (
                        <tr key={idx} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2 font-mono text-slate-900 dark:text-white">{item.month}</td>
                          <td className="px-4 py-2 text-slate-900 dark:text-white">{item.category_id}</td>
                          <td className="px-4 py-2 text-slate-900 dark:text-white font-semibold">{item.count}</td>
                          <td className="px-4 py-2">
                            <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded h-6 overflow-hidden">
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
