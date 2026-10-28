import React, { useState } from 'react';
import {
  Shield,
  Key,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState<string>('');
  const [adminStatusMessage, setAdminStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load analytics overview
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.getAnalyticsOverview,
  });

  // Reset Demo Mutation
  const resetDemoMutation = useMutation({
    mutationFn: (key: string) => api.resetDemoDatabase(key),
    onSuccess: (data) => {
      setAdminStatusMessage({
        type: 'success',
        text: `Demo database reseeded successfully: ${data.details.facilities} facilities, ${data.details.reports} reports.`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : 'Failed to reset demo data. Check admin key.';
      setAdminStatusMessage({ type: 'error', text: msg });
    },
  });

  // Moderation Mutation
  const moderateMutation = useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: 'APPROVED' | 'REJECTED' | 'FLAGGED' }) =>
      api.moderateReport(reportId, action, adminKey),
    onSuccess: () => {
      setAdminStatusMessage({ type: 'success', text: 'Report moderation status updated.' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : 'Moderation failed.';
      setAdminStatusMessage({ type: 'error', text: msg });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
              <Shield size={18} />
            </span>
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
              Administration & Validation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            System Moderation & Dataset Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage live observation streams, moderate flagged claims, and reset demonstration states.
          </p>
        </div>

        {/* Admin Key Configuration */}
        <form onSubmit={(e) => e.preventDefault()} className="w-full sm:w-auto bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <label htmlFor="admin-secret-input" className="block text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <Key size={12} />
            <span>Admin Authentication Key</span>
          </label>
          <input
            id="admin-secret-input"
            type="password"
            autoComplete="current-password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full sm:w-64 px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 focus:ring-1 focus:ring-teal-500"
            placeholder="Enter server admin secret key"
          />
          <span className="text-[10px] text-slate-400 block">
            Requires server-configured <code>ADMIN_SECRET_KEY</code>
          </span>
        </form>
      </div>

      {adminStatusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-2 ${adminStatusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          {adminStatusMessage.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{adminStatusMessage.text}</span>
        </div>
      )}

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Total Facilities</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {isLoading ? '...' : analytics?.total_facilities}
          </span>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
            {analytics?.total_features} monitored features
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Total Reports Logged</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {isLoading ? '...' : analytics?.total_reports}
          </span>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
            Realtime DB count
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Evidence Breakdown</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-emerald-700 font-bold text-lg">{analytics?.likely_working_features} OK</span>
            <span className="text-slate-300">/</span>
            <span className="text-rose-700 font-bold text-lg">{analytics?.likely_unavailable_features} DOWN</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
            {analytics?.conflicting_features} conflicting, {analytics?.unknown_features} unknown
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Freshness State</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-teal-700 font-bold text-lg">{analytics?.fresh_features} Fresh</span>
            <span className="text-slate-300">/</span>
            <span className="text-amber-700 font-bold text-lg">{analytics?.stale_features} Stale</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
            Based on active half-lives
          </span>
        </div>
      </div>

      {/* Database Management Tools */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Demonstration Dataset Control
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Reset the database to the 14 reference JIIT campus facilities with varied report histories for a reproducible 3-minute hackathon demo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => resetDemoMutation.mutate(adminKey)}
          disabled={resetDemoMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw size={16} className={resetDemoMutation.isPending ? 'animate-spin' : ''} />
          <span>Reset / Reseed Demo Data</span>
        </button>
      </div>

      {/* Recent Reports Moderation Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Reports & Moderation Queue</h3>
            <p className="text-xs text-slate-500">Inspect submitted evidence and take moderation actions.</p>
          </div>
          <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
            Live Database Feed
          </span>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {analytics?.recent_reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No reports in moderation queue.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Status & Facility</th>
                  <th className="py-3 px-4">Reported Status</th>
                  <th className="py-3 px-4">Source Declaration</th>
                  <th className="py-3 px-4">Note / Observation</th>
                  <th className="py-3 px-4">Created Time</th>
                  <th className="py-3 px-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analytics?.recent_reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>ID: {rep.facility_id}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rep.is_demo_data ? 'Demo Record' : 'Live Submission'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={rep.reported_status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">
                        {rep.source_type.replace('_', ' ')}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        (Unverified claim)
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {(rep.crowd_level || rep.laundry_status || rep.estimated_time) && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {rep.crowd_level && (
                            <span className="text-[10px] bg-cyan-100 text-cyan-900 font-semibold px-1.5 py-0.2 rounded">
                              Crowd: {rep.crowd_level}
                            </span>
                          )}
                          {rep.laundry_status && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-900 font-semibold px-1.5 py-0.2 rounded">
                              Status: {rep.laundry_status}
                            </span>
                          )}
                          {rep.estimated_time && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                              Est: {rep.estimated_time}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="truncate">
                        {rep.note || <span className="text-slate-400 italic">No notes</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => moderateMutation.mutate({ reportId: rep.id, action: 'APPROVED' })}
                        title="Approve Report"
                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium text-[11px] cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => moderateMutation.mutate({ reportId: rep.id, action: 'FLAGGED' })}
                        title="Flag Report for review"
                        className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium text-[11px] cursor-pointer"
                      >
                        Flag
                      </button>
                      <button
                        onClick={() => moderateMutation.mutate({ reportId: rep.id, action: 'REJECTED' })}
                        title="Reject Report"
                        className="px-2 py-1 rounded bg-rose-50 text-rose-800 hover:bg-rose-100 font-medium text-[11px] cursor-pointer"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
