'use client';

import { useState } from 'react';
import { store } from '@/lib/store';
import { checkGitHubRepoPermissions } from '@/lib/github';
import { Tenant } from '@/types';

interface TenantRowProps {
  tenant: Tenant;
  onRefresh: () => void;
}

function TenantRow({ tenant, onRefresh }: TenantRowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const statusColor =
    tenant.status === 'active'
      ? 'bg-emerald-900 text-emerald-200 border-emerald-500'
      : 'bg-amber-900 text-amber-200 border-amber-500';

  const runHealthCheck = async (tenantId: string) => {
    setIsLoading(true);
    setMessage('Running health check...');
    try {
      const t = store.getTenant(tenantId);
      if (!t) throw new Error('Tenant not found');
      const result = await checkGitHubRepoPermissions(t.github_owner, t.github_repo);
      if (result.ok) {
        t.status = 'active';
      } else {
        t.status = 'setup_incomplete';
      }
      store.saveTenant(t);
      setMessage(`✅ Health check: ${result.message}`);
      setTimeout(() => onRefresh(), 1000);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    if (!confirm('Delete this tenant binding?')) return;
    setIsLoading(true);
    try {
      const t = store.getTenant(tenantId);
      if (t) {
        store['tenants'].delete(tenantId);
        setMessage('✅ Tenant deleted');
        setTimeout(() => onRefresh(), 500);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-slate-850">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-100">{tenant.name}</div>
          <div className="text-xs text-slate-500 font-mono">{tenant.id}</div>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-300">{tenant.jules_source_name}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-300">
          {tenant.github_owner}/{tenant.github_repo}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-300">{tenant.default_branch}</td>
        <td className="px-4 py-3 text-slate-300">{tenant.monthly_limit}</td>
        <td className="px-4 py-3 text-slate-300">{tenant.used_count}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
            {tenant.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            <button
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition disabled:opacity-50"
              onClick={() => runHealthCheck(tenant.id)}
            >
              {isLoading ? 'Checking...' : 'Re-check Health'}
            </button>
            <button
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded transition disabled:opacity-50"
              onClick={() => deleteTenant(tenant.id)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {message && (
        <tr>
          <td colSpan={8} className="px-4 py-2 text-sm text-indigo-300">
            {message}
          </td>
        </tr>
      )}
    </>
  );
}

export default TenantRow;