'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [tenantId, setTenantId] = useState('tenant-demo');
  const [format, setFormat] = useState<'text' | 'csv' | 'json'>('text');
  const [inputContent, setInputContent] = useState('Update homepage hero headline to "Next-Gen AI Storefront"');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Bind tenant form state
  const [bindTenantId, setBindTenantId] = useState('tenant-demo');
  const [bindName, setBindName] = useState('Acme Storefront');
  const [bindSource, setBindSource] = useState('sources/github-acmeco-storefront');
  const [bindOwner, setBindOwner] = useState('acmeco');
  const [bindRepo, setBindRepo] = useState('storefront');
  const [bindMsg, setBindMsg] = useState('');

  // Subscribe to SSE updates when activeJobId changes
  useEffect(() => {
    if (!activeJobId) return;

    const eventSource = new EventSource(`/api/cms/requests/${activeJobId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJobStatus(data);
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Status: ${data.customerStatus} (Internal: ${data.internalState})`,
          ...prev,
        ]);

        if (
          data.internalState === 'done' ||
          data.internalState === 'rejected' ||
          data.internalState === 'failed'
        ) {
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [activeJobId]);

  const handleBindTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBindMsg('Binding tenant...');
    try {
      const res = await fetch('/api/cms/tenants/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: bindTenantId,
          name: bindName,
          julesSourceName: bindSource,
          githubOwner: bindOwner,
          githubRepo: bindRepo,
          defaultBranch: 'main',
          monthlyLimit: 5,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBindMsg(`✅ ${data.message} Status: ${data.tenant.status}`);
      } else {
        setBindMsg(`❌ Error: ${data.error || data.message}`);
      }
    } catch (err: any) {
      setBindMsg(`❌ Failed: ${err.message}`);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setJobStatus(null);
    setLogs([]);

    try {
      let contentType = 'text/plain';
      if (format === 'csv') contentType = 'text/csv';
      if (format === 'json') contentType = 'application/json';

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'x-tenant-id': tenantId,
      };

      if (idempotencyKey.trim()) {
        headers['x-idempotency-key'] = idempotencyKey.trim();
      }

      const res = await fetch(`/api/cms/requests?format=${format}`, {
        method: 'POST',
        headers,
        body: inputContent,
      });

      const data = await res.json();

      if (res.status === 202) {
        setActiveJobId(data.jobId);
        setLogs([`Job accepted with ID: ${data.jobId}`]);
      } else {
        alert(`Error (${res.status}): ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      alert(`Submit failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-extrabold text-indigo-400">
          AI-Powered CMS Orchestrator Dashboard
        </h1>
        <p className="text-slate-400 mt-1">
          Deterministic queue worker & management interface for Jules, Slack, GitHub, and Vercel.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section 0: Tenant Jules Source Binding */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
          <h2 className="text-xl font-bold text-slate-200">
            0. Bind Tenant to Jules Source
          </h2>
          <form onSubmit={handleBindTenant} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400">Tenant ID</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={bindTenantId}
                onChange={(e) => setBindTenantId(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Tenant Name</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={bindName}
                onChange={(e) => setBindName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">
                Jules Source Resource Name
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={bindSource}
                onChange={(e) => setBindSource(e.target.value)}
                placeholder="sources/github-acmeco-storefront"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400">GitHub Owner</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                  value={bindOwner}
                  onChange={(e) => setBindOwner(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400">GitHub Repo</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                  value={bindRepo}
                  onChange={(e) => setBindRepo(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 font-medium py-2 rounded text-sm transition"
            >
              Bind Source & Health Check
            </button>
          </form>
          {bindMsg && <p className="text-sm text-indigo-300 mt-2">{bindMsg}</p>}
        </section>

        {/* Section 1: Request Intake */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
          <h2 className="text-xl font-bold text-slate-200">1. Submit CMS Request</h2>
          <form onSubmit={handleSubmitRequest} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400">Target Tenant ID</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Format</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
              >
                <option value="text">Text (Plain Text)</option>
                <option value="csv">CSV (page, component, property, newValue, note)</option>
                <option value="json">JSON Blueprint Schema</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">
                Idempotency Key (Optional)
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                placeholder="e.g. req-abc-123"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Payload Content</label>
              <textarea
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 font-mono"
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-medium py-2 rounded text-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Send Request (POST /api/cms/requests)'}
            </button>
          </form>
        </section>
      </div>

      {/* Section 8: Real-time Status Model Stream */}
      {activeJobId && (
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h2 className="text-xl font-bold text-slate-200">
              Job Real-Time Status Stream: <span className="font-mono text-indigo-300">{activeJobId}</span>
            </h2>
            {jobStatus && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  jobStatus.customerStatus === 'Done ✅'
                    ? 'bg-emerald-900 text-emerald-200 border border-emerald-500'
                    : jobStatus.customerStatus === 'Not approved' ||
                      jobStatus.customerStatus?.includes("Couldn't")
                    ? 'bg-rose-900 text-rose-200 border border-rose-500'
                    : 'bg-amber-900 text-amber-200 border border-amber-500 animate-pulse'
                }`}
              >
                {jobStatus.customerStatus}
              </span>
            )}
          </div>

          {jobStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-900 p-4 rounded border border-slate-800">
              <div>
                <p className="text-slate-400">Internal State:</p>
                <p className="font-mono text-indigo-400 font-semibold">{jobStatus.internalState}</p>
              </div>
              <div>
                <p className="text-slate-400">Jules Session State:</p>
                <p className="font-mono text-slate-200">{jobStatus.julesState || 'N/A'}</p>
              </div>
              {jobStatus.pullRequest && (
                <div className="col-span-2">
                  <p className="text-slate-400">Pull Request:</p>
                  <a
                    href={jobStatus.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300"
                  >
                    {jobStatus.pullRequest.url} (PR #{jobStatus.pullRequest.number})
                  </a>
                </div>
              )}
              {jobStatus.failureReason && (
                <div className="col-span-2 text-rose-400 font-medium">
                  Failure Reason: {jobStatus.failureReason}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Live SSE Logs</h3>
            <div className="bg-slate-950 p-4 rounded font-mono text-xs text-emerald-400 max-h-48 overflow-y-auto space-y-1">
              {logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
