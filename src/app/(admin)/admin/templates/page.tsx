'use client';

import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { Tenant } from '@/types';

interface PromptTemplate {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  isQuickSubmit: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTemplatesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [formData, setFormData] = useState({
    tenantId: '',
    title: '',
    body: '',
    isQuickSubmit: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setTenants(store.getAllTenants());
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const params = selectedTenantId ? `?tenantId=${selectedTenantId}` : '';
    const res = await fetch(`/api/cms/prompt-templates${params}`);
    const data = await res.json();
    if (res.ok) {
      setTemplates(data.templates || []);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedTenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const url = editingId ? `/api/cms/prompt-templates/${editingId}` : '/api/cms/prompt-templates';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${editingId ? 'Updated' : 'Created'} template: ${data.template.title}`);
        setFormData({ tenantId: '', title: '', body: '', isQuickSubmit: false });
        setEditingId(null);
        fetchTemplates();
      } else {
        setMessage(`❌ ${data.error}: ${JSON.stringify(data.details || data.message)}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingId(template.id);
    setFormData({
      tenantId: template.tenantId,
      title: template.title,
      body: template.body,
      isQuickSubmit: template.isQuickSubmit,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cms/prompt-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage('✅ Template deleted');
        fetchTemplates();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSubmit = async (template: PromptTemplate) => {
    // Navigate to customer dashboard with pre-filled template
    const params = new URLSearchParams({
      tenantId: template.tenantId,
      format: 'text',
      content: template.body,
    });
    window.open(`/dashboard?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100">Prompt Suggestions & Templates</h1>
          <p className="text-slate-400 mt-1">
            Curate reusable prompt templates per tenant. Quick-submit templates pre-fill the customer submission form.
          </p>
        </div>
      </div>

      {/* Tenant Filter */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <label className="block text-xs font-semibold text-slate-400 mb-2">Filter by Tenant</label>
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
        >
          <option value="">All Tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.id})
            </option>
          ))}
        </select>
      </section>

      {/* Create/Edit Form */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-100">
          {editingId ? 'Edit Template' : 'Create New Template'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant</label>
            <select
              name="tenantId"
              value={formData.tenantId}
              onChange={handleChange}
              className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              required
            >
              <option value="">Select Tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              placeholder="e.g., Update Hero Headline"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Template Body</label>
            <textarea
              name="body"
              value={formData.body}
              onChange={handleChange}
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 font-mono"
              placeholder='Change the homepage hero headline to "..."'
              required
            />
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
              <input
                name="isQuickSubmit"
                type="checkbox"
                checked={formData.isQuickSubmit}
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 border-slate-600 rounded focus:ring-indigo-500"
              />
              <span>Quick Submit (one-click template for customers)</span>
            </label>
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ tenantId: '', title: '', body: '', isQuickSubmit: false });
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 font-medium rounded transition"
              >
                Cancel Edit
              </button>
            )}
            {message && <span className="text-sm text-indigo-300">{message}</span>}
          </div>
        </form>
      </section>

      {/* Templates List */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100">Templates ({templates.length})</h2>
        </div>
        {templates.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No templates yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Submit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {templates.map((template) => {
                  const tenant = tenants.find((t) => t.id === template.tenantId);
                  return (
                    <tr key={template.id} className="hover:bg-slate-850">
                      <td className="px-4 py-3 font-medium text-slate-100">{template.title}</td>
                      <td className="px-4 py-3 text-slate-300">{tenant?.name || template.tenantId}</td>
                      <td className="px-4 py-3">
                        <code className="text-slate-400 text-xs bg-slate-900 px-2 py-1 rounded max-w-xs block truncate">
                          {template.body.substring(0, 80)}{template.body.length > 80 ? '...' : ''}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${template.isQuickSubmit ? 'bg-emerald-900 text-emerald-200 border-emerald-500' : 'bg-slate-700 text-slate-300 border-slate-500'} border`}>
                          {template.isQuickSubmit ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(template)}
                            className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
                          >
                            Edit
                          </button>
                          {template.isQuickSubmit && (
                            <button
                              onClick={() => handleQuickSubmit(template)}
                              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
                            >
                              Try Quick Submit
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}