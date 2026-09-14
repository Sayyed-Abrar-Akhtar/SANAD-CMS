'use client';

import { useState } from 'react';
import { store } from '@/lib/store';
import { checkGitHubRepoPermissions } from '@/lib/github';

export default function TenantBindingForm({ onRefresh }: { onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    tenantId: '',
    name: '',
    julesSourceName: 'sources/github-',
    githubOwner: '',
    githubRepo: '',
    defaultBranch: 'main',
    monthlyLimit: 5,
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'monthlyLimit' ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/cms/tenants/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setTimeout(() => onRefresh(), 1000);
      } else {
        setMessage(`❌ ${data.error}: ${data.details ? JSON.stringify(data.details) : data.message}`);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant ID</label>
          <input
            name="tenantId"
            value={formData.tenantId}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            placeholder="tenant-acmeco"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Tenant Name</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            placeholder="Acme Storefront"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 mb-1">Jules Source Resource Name</label>
          <input
            name="julesSourceName"
            value={formData.julesSourceName}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            placeholder="sources/github-acmeco-storefront"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Owner</label>
          <input
            name="githubOwner"
            value={formData.githubOwner}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            placeholder="acmeco"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Repo</label>
          <input
            name="githubRepo"
            value={formData.githubRepo}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            placeholder="storefront"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Default Branch</label>
          <input
            name="defaultBranch"
            value={formData.defaultBranch}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            defaultValue="main"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Monthly Limit</label>
          <input
            name="monthlyLimit"
            type="number"
            value={formData.monthlyLimit}
            onChange={handleChange}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            min="1"
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
        >
          {isLoading ? 'Binding...' : 'Bind Tenant & Run Health Check'}
        </button>
        {message && <span className="text-sm text-indigo-300">{message}</span>}
      </div>
    </form>
  );
}