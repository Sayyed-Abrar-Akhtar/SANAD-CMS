'use client';

import { useState, useEffect, useCallback } from 'react';

export default function DashboardPage() {
  const [tenantId, setTenantId] = useState('tenant-demo');
  const [format, setFormat] = useState<'text' | 'csv' | 'json'>('text');
  const [inputContent, setInputContent] = useState('Update homepage hero headline to "Next-Gen AI Storefront"');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  // Prompt templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

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

  // Fetch prompt templates for current tenant
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/cms/prompt-templates?tenantId=${tenantId}`);
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadResult(null);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadedFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('tenantId', tenantId);
      formData.append('format', format);
      if (idempotencyKey.trim()) {
        formData.append('idempotencyKey', idempotencyKey.trim());
      }

      const res = await fetch('/api/cms/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        // Auto-fill the form with parsed content
        if (data.rawText) {
          setInputContent(data.rawText);
        }
        setFormat(data.format);
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setInputContent(template.body);
    setFormat('text'); // Templates are text format
    setShowTemplates(false);
  };

  const handleTemplateQuickSubmit = async (template: any) => {
    // Submit directly using the template
    setIsSubmitting(true);
    setJobStatus(null);
    setLogs([]);

    try {
      const res = await fetch(`/api/cms/requests?format=text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'x-tenant-id': tenantId,
        },
        body: template.body,
      });

      const data = await res.json();

      if (res.status === 202) {
        setActiveJobId(data.jobId);
        setLogs([`Quick-submit job accepted with ID: ${data.jobId}`]);
      } else {
        alert(`Error (${res.status}): ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      alert(`Submit failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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

  const handleUrlParams = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTenantId = params.get('tenantId');
    const urlFormat = params.get('format') as 'text' | 'csv' | 'json' | null;
    const urlContent = params.get('content');

    if (urlTenantId) setTenantId(urlTenantId);
    if (urlFormat) setFormat(urlFormat);
    if (urlContent) setInputContent(decodeURIComponent(urlContent));
  }, []);

  useEffect(() => {
    handleUrlParams();
  }, [handleUrlParams]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-extrabold text-indigo-400">
          AI-Powered CMS Orchestrator Dashboard
        </h1>
        <p className="text-slate-400 mt-1">
          Submit content changes via text, CSV, JSON, or file upload. Track progress in real-time.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input & Upload */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: File Upload */}
          <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
            <h2 className="text-xl font-bold text-slate-200 flex items-center justify-between">
              1. Upload File (.txt, .csv, .json, .docx)
              {uploadedFile && (
                <span className="text-sm text-emerald-400 font-mono">{uploadedFile.name} ({uploadedFile.size} bytes)</span>
              )}
            </h2>
            <div className="space-y-3">
              <input
                type="file"
                accept=".txt,.csv,.json,.docx"
                onChange={handleFileSelect}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 file:mr-4 file:py-2 file:px-4 file:rounded file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
              />
              {uploadedFile && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleFileUpload}
                    disabled={isUploading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
                  >
                    {isUploading ? 'Parsing...' : 'Parse & Load File'}
                  </button>
                  <button
                    onClick={() => { setUploadedFile(null); setUploadResult(null); }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 font-medium rounded transition"
                  >
                    Clear
                  </button>
                </div>
              )}
              {uploadResult && (
                <div className="bg-slate-900 border border-slate-700 rounded p-3 text-sm space-y-1">
                  <p className="text-emerald-400">✅ File parsed successfully</p>
                  <p className="text-slate-300">Format detected: <span className="font-mono text-indigo-300">{uploadResult.format}</span></p>
                  <p className="text-slate-300">Preview: <span className="font-mono text-slate-200">{uploadResult.rawText?.substring(0, 100)}...</span></p>
                </div>
              )}
            </div>
          </section>

          {/* Section: Prompt Templates */}
          <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
            <h2 className="text-xl font-bold text-slate-200 flex items-center justify-between">
              2. Prompt Suggestions & Quick-Start Templates
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-sm text-indigo-400 hover:text-indigo-300 underline"
              >
                {showTemplates ? 'Hide' : 'Show'} Templates ({templates.length})
              </button>
            </h2>
            {showTemplates && templates.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {templates.map((template: any) => (
                  <div
                    key={template.id}
                    className="bg-slate-900 border border-slate-700 rounded p-3 hover:border-indigo-500 transition cursor-pointer"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-slate-100">{template.title}</h3>
                      {template.isQuickSubmit && (
                        <span className="px-2 py-0.5 text-xs bg-emerald-900 text-emerald-200 rounded">
                          Quick Submit
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 font-mono mt-1 truncate">{template.body}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTemplateSelect(template); }}
                        className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded transition"
                      >
                        Load Template
                      </button>
                      {template.isQuickSubmit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTemplateQuickSubmit(template); }}
                          className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded transition"
                        >
                          Quick Submit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showTemplates && templates.length === 0 && (
              <p className="text-slate-500 text-sm">No templates available for this tenant. Ask admin to create some.</p>
            )}
          </section>

          {/* Section: Manual Input */}
          <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
            <h2 className="text-xl font-bold text-slate-200">3. Or Enter Request Manually</h2>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant ID</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Format</label>
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
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Payload Content</label>
                <textarea
                  className="w-full h-40 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 font-mono"
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  required
                  placeholder={format === 'csv' 
                    ? 'page,component,property,newValue,note\nhomepage,Hero,headline,New Headline,Update for Q4'
                    : format === 'json'
                    ? '{\n  "targets": [\n    {"page": "homepage", "component": "Hero", "property": "headline", "value": "New Headline"}\n  ],\n  "summary": "Update hero headline",\n  "riskFlags": []\n}'
                    : 'Update homepage hero headline to "Next-Gen AI Storefront"'
                  }
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-medium py-3 rounded text-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Send Request (POST /api/cms/requests)'}
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Status Stream */}
        <div className="lg:col-span-1 space-y-6">
          {activeJobId && (
            <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4 sticky top-24">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h2 className="text-xl font-bold text-slate-200">
                  Job Status Stream
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
                <div className="space-y-3 text-sm bg-slate-900 p-4 rounded border border-slate-800">
                  <div>
                    <p className="text-slate-400">Job ID:</p>
                    <p className="font-mono text-indigo-400 font-semibold">{jobStatus.jobId}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Internal State:</p>
                    <p className="font-mono text-indigo-400 font-semibold">{jobStatus.internalState}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Jules Session State:</p>
                    <p className="font-mono text-slate-200">{jobStatus.julesState || 'N/A'}</p>
                  </div>
                  {jobStatus.pullRequest && (
                    <div>
                      <p className="text-slate-400">Pull Request:</p>
                      <a
                        href={jobStatus.pullRequest.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 underline hover:text-indigo-300 font-mono text-xs"
                      >
                        {jobStatus.pullRequest.url} (PR #{jobStatus.pullRequest.number})
                      </a>
                    </div>
                  )}
                  {jobStatus.deployment && (
                    <div>
                      <p className="text-slate-400">Deployment:</p>
                      <p className="font-mono text-slate-200">
                        {jobStatus.deployment.status} {jobStatus.deployment.url ? `(${jobStatus.deployment.url})` : ''}
                      </p>
                    </div>
                  )}
                  {jobStatus.failureReason && (
                    <div className="text-rose-400 font-medium">
                      Failure Reason: {jobStatus.failureReason}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Live SSE Logs</h3>
                <div className="bg-slate-950 p-4 rounded font-mono text-xs text-emerald-400 max-h-64 overflow-y-auto space-y-1">
                  {logs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                  {logs.length === 0 && <div className="text-slate-500">Waiting for updates...</div>}
                </div>
              </div>
            </section>
          )}

          {!activeJobId && (
            <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 text-center">
              <div className="text-slate-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-lg">No active job</p>
                <p className="text-sm mt-1">Submit a request to see real-time status here</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}