'use client';

import { useState } from 'react';
import { store } from '@/lib/store';
import { Tenant } from '@/types';

interface TenantUsageStat {
  tenant: Tenant;
  submittedCount: number;
  shippedCount: number;
  remaining: number;
  usedCount: number;
  limit: number;
}

interface AdminUsageClientProps {
  initialStats: TenantUsageStat[];
}

export default function AdminUsageClient({ initialStats }: AdminUsageClientProps) {
  const [stats, setStats] = useState<TenantUsageStat[]>(initialStats);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleLimitChange = async (tenantId: string, newLimit: number) => {
    setIsLoading(tenantId);
    setMessage('');
    try {
      const tenant = store.getTenant(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      tenant.monthly_limit = newLimit;
      store.saveTenant(tenant);

      setStats((prev) =>
        prev.map((s) => (s.tenant.id === tenantId ? { ...s, limit: newLimit, remaining: Math.max(0, newLimit - s.usedCount) } : s))
      );
      setMessage(`✅ Updated limit for ${tenant.name} to ${newLimit}`);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleResetUsage = async (tenantId: string) => {
    if (!confirm('Reset usage counter for this tenant?')) return;
    setIsLoading(tenantId);
    try {
      const tenant = store.getTenant(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      tenant.used_count = 0;
      store.saveTenant(tenant);

      setStats((prev) =>
        prev.map((s) => (s.tenant.id === tenantId ? { ...s, usedCount: 0, remaining: s.limit } : s))
      );
      setMessage(`✅ Reset usage counter for ${tenant.name}`);
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-indigo-900/30 border border-indigo-500 text-indigo-300 p-3 rounded text-sm">
          {message}
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <div>Tenant</div>
            <div className="text-center">Submitted</div>
            <div className="text-center">Shipped</div>
            <div className="text-center">Counter</div>
            <div className="text-center">Limit</div>
            <div className="text-center">Remaining</div>
            <div className="text-center">Actions</div>
          </div>
        </div>
        <div className="divide-y divide-slate-800">
          {stats.map((stat) => (
            <div key={stat.tenant.id} className="p-4 hover:bg-slate-850">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                <div className="font-medium text-slate-100">{stat.tenant.name}</div>
                <div className="text-center text-slate-300 font-mono">{stat.submittedCount}</div>
                <div className="text-center text-emerald-400 font-mono">{stat.shippedCount}</div>
                <div className="text-center text-slate-300 font-mono">{stat.usedCount}</div>
                <div className="text-center">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={stat.limit}
                    onChange={(e) => handleLimitChange(stat.tenant.id, parseInt(e.target.value, 10))}
                    disabled={isLoading === stat.tenant.id}
                    className="w-20 mx-auto bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-100 text-center"
                  />
                </div>
                <div className="text-center text-amber-400 font-mono font-semibold">{stat.remaining}</div>
                <div className="text-center">
                  <button
                    onClick={() => handleResetUsage(stat.tenant.id)}
                    disabled={isLoading === stat.tenant.id}
                    className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded transition disabled:opacity-50"
                  >
                    Reset Counter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {stats.length === 0 && (
          <div className="p-12 text-center text-slate-500">No tenants configured.</div>
        )}
      </div>

      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Usage Counter Logic</h2>
        <div className="text-sm text-slate-300 space-y-2">
          <p><strong>Submitted:</strong> Total CMS requests submitted this calendar month (regardless of outcome).</p>
          <p><strong>Shipped:</strong> Requests that reached <code className="bg-slate-900 px-1 rounded">done</code> state (merged + deployed).</p>
          <p><strong>Counter (used_count):</strong> Incremented when a Jules session starts code generation (§2 spec). This is what the monthly limit checks against.</p>
          <p><strong>Limit:</strong> Per-tenant monthly ceiling. Default 5. Editable per tenant above.</p>
          <p><strong>Remaining:</strong> <code>limit - used_count</code>. When 0, new requests are rejected at intake.</p>
        </div>
      </section>
    </div>
  );
}