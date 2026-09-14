'use client';

import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { Job } from '@/types';
import { getCustomerStatus } from '@/types';

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tenantId, setTenantId] = useState('tenant-demo');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [tenantId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, tenantId]);

  const fetchJobs = () => {
    const allJobs = store.getJobsByTenant(tenantId);
    allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setJobs(allJobs);
  };

  const getStatusBadgeClass = (status: Job['internalState']) => {
    switch (status) {
      case 'done': return 'bg-emerald-900 text-emerald-200 border-emerald-500';
      case 'rejected': return 'bg-rose-900 text-rose-200 border-rose-500';
      case 'failed': return 'bg-rose-900 text-rose-200 border-rose-500';
      case 'pending_review': return 'bg-indigo-900 text-indigo-200 border-indigo-500';
      case 'merged_pending_deploy': return 'bg-amber-900 text-amber-200 border-amber-500';
      case 'generating_code': case 'interpreting': case 'queued': return 'bg-slate-700 text-slate-200 border-slate-500';
      case 'needs_input': return 'bg-violet-900 text-violet-200 border-violet-500';
      default: return 'bg-slate-700 text-slate-200 border-slate-500';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-extrabold text-indigo-400">Request History</h1>
        <p className="text-slate-400 mt-1">View all your CMS change requests and their status.</p>
      </header>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant ID</label>
            <input
              className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
          <label className="flex items-center space-x-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-600 rounded focus:ring-indigo-500"
            />
            <span>Auto-refresh (5s)</span>
          </label>
          <button onClick={fetchJobs} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition">
            Refresh
          </button>
        </div>
      </div>

      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Job ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Format</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer View</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Jules State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">PR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {jobs.map((job) => {
                const customerStatus = getCustomerStatus(job.internalState, job.julesState);
                const statusClass = getStatusBadgeClass(job.internalState);
                return (
                  <tr key={job.jobId} className="hover:bg-slate-850 cursor-pointer" onClick={() => setSelectedJob(job)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{job.jobId}</td>
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
                        onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                        className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No requests found for this tenant.
          </div>
        )}
      </section>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedJob(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Job Details: {selectedJob.jobId}</h2>
              <button onClick={() => setSelectedJob(null)} className="text-slate-400 hover:text-slate-200 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Internal State</p>
                  <p className="font-mono text-indigo-400 font-semibold">{selectedJob.internalState}</p>
                </div>
                <div>
                  <p className="text-slate-400">Customer Status</p>
                  <p className="font-medium text-slate-100">{getCustomerStatus(selectedJob.internalState, selectedJob.julesState)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Jules State</p>
                  <p className="font-mono text-slate-200">{selectedJob.julesState || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Format</p>
                  <p className="font-mono text-slate-200">{selectedJob.format}</p>
                </div>
                <div>
                  <p className="text-slate-400">Created</p>
                  <p className="text-slate-200">{new Date(selectedJob.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400">Updated</p>
                  <p className="text-slate-200">{new Date(selectedJob.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedJob.blueprint && (
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Blueprint</h3>
                  <pre className="bg-slate-900 border border-slate-700 rounded p-4 text-xs text-slate-200 overflow-auto max-h-64">
                    {JSON.stringify(selectedJob.blueprint, null, 2)}
                  </pre>
                </div>
              )}

              {selectedJob.pullRequest && (
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Pull Request</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-slate-400">URL: </span><a href={selectedJob.pullRequest.url} target="_blank" rel="noreferrer" className="text-indigo-400 underline">{selectedJob.pullRequest.url}</a></p>
                    <p><span className="text-slate-400">Number: </span><span className="font-mono">#{selectedJob.pullRequest.number}</span></p>
                    <p><span className="text-slate-400">Branch: </span><span className="font-mono">{selectedJob.pullRequest.branch}</span></p>
                  </div>
                </div>
              )}

              {selectedJob.deployment && (
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Deployment</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-slate-400">Status: </span><span className="font-mono">{selectedJob.deployment.status}</span></p>
                    {selectedJob.deployment.url && (
                      <p><span className="text-slate-400">URL: </span><a href={selectedJob.deployment.url} target="_blank" rel="noreferrer" className="text-indigo-400 underline">{selectedJob.deployment.url}</a></p>
                    )}
                    {selectedJob.deployment.id && (
                      <p><span className="text-slate-400">ID: </span><span className="font-mono">{selectedJob.deployment.id}</span></p>
                    )}
                  </div>
                </div>
              )}

              {selectedJob.failureReason && (
                <div className="bg-rose-900/30 border border-rose-500 rounded p-4 text-rose-300">
                  <h3 className="font-semibold mb-1">Failure Reason</h3>
                  <p>{selectedJob.failureReason}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700">
                <h3 className="font-semibold text-slate-100 mb-2">Raw Input</h3>
                <pre className="bg-slate-900 border border-slate-700 rounded p-4 text-xs text-slate-200 overflow-auto max-h-48 whitespace-pre-wrap">
                  {selectedJob.rawInput}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}