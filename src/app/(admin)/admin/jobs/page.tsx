'use client';

import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { Job, Tenant } from '@/types';
import { getCustomerStatus } from '@/types';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    setTenants(store.getAllTenants());
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchJobs = () => {
    let allJobs = Array.from(store['jobs']?.values() || []);

    if (selectedTenantId) {
      allJobs = allJobs.filter((j) => j.tenantId === selectedTenantId);
    }
    if (selectedStatus) {
      allJobs = allJobs.filter((j) => j.internalState === selectedStatus);
    }

    // Sort by createdAt descending
    allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setJobs(allJobs);
  };

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTenantId(e.target.value);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
  };

  const getStatusBadgeClass = (status: Job['internalState']) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-900 text-emerald-200 border-emerald-500';
      case 'rejected':
        return 'bg-rose-900 text-rose-200 border-rose-500';
      case 'failed':
        return 'bg-rose-900 text-rose-200 border-rose-500';
      case 'pending_review':
        return 'bg-indigo-900 text-indigo-200 border-indigo-500';
      case 'merged_pending_deploy':
        return 'bg-amber-900 text-amber-200 border-amber-500';
      case 'generating_code':
      case 'interpreting':
      case 'queued':
        return 'bg-slate-700 text-slate-200 border-slate-500';
      case 'needs_input':
        return 'bg-violet-900 text-violet-200 border-violet-500';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100">All Jobs</h1>
          <p className="text-slate-400 mt-1">Monitor and debug orchestration jobs across all tenants.</p>
        </div>
        <label className="flex items-center space-x-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-600 rounded focus:ring-indigo-500"
          />
          <span>Auto-refresh (3s)</span>
        </label>
      </div>

      {/* Filters */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant</label>
            <select
              value={selectedTenantId}
              onChange={handleTenantChange}
              className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            >
              <option value="">All Tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={handleStatusChange}
              className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="interpreting">Interpreting</option>
              <option value="generating_code">Generating Code</option>
              <option value="needs_input">Needs Input</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
              <option value="merged_pending_deploy">Merged, Pending Deploy</option>
              <option value="done">Done</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <button onClick={fetchJobs} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition">
            Refresh
          </button>
        </div>
      </section>

      {/* Jobs Table */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Job ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Format</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Internal State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Jules State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">PR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {jobs.map((job) => {
                const tenant = tenants.find((t) => t.id === job.tenantId);
                const customerStatus = getCustomerStatus(job.internalState, job.julesState);
                const statusClass = getStatusBadgeClass(job.internalState);
                return (
                  <tr key={job.jobId} className="hover:bg-slate-850">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{job.jobId}</td>
                    <td className="px-4 py-3 text-slate-300">{tenant?.name || job.tenantId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{job.format}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
                        {job.internalState}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{customerStatus}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{job.julesState || 'N/A'}</td>
                    <td className="px-4 py-3">
                      {job.pullRequest ? (
                        <a href={job.pullRequest.url} target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300">
                          PR #{job.pullRequest.number}
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(job, null, 2))}
                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition"
                      >
                        Copy JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <div className="p-12 text-center text-slate-500">No jobs found matching filters.</div>
        )}
      </section>

      {/* Job Detail Modal would go here in a full implementation */}
    </div>
  );
}