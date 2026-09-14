'use client';

import { useState } from 'react';
import { store } from '@/lib/store';
import { Tenant } from '@/types';
import TenantRow from './TenantRow';
import TenantBindingForm from './TenantBindingForm';

export default function AdminTenantsClient() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // This runs on the client, but we need server data
  // We'll use a different approach - the parent server component passes tenants as props
  return null; // This component will be replaced by the server component pattern
}

// Actually, let's use a different pattern: Server component with Client wrapper
export function AdminTenantsClientWrapper({ initialTenants }: { initialTenants: Tenant[] }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    // Re-fetch from store
    setTenants(store.getAllTenants());
  };

  return (
    <div className="space-y-8" key={refreshKey}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100">Tenant ↔ Jules Source Binding</h1>
          <p className="text-slate-400 mt-1">
            Bind each tenant to a Jules Source and verify GitHub PR permissions health check.
          </p>
        </div>
      </div>

      {/* Create New Tenant Binding Form */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-bold text-slate-100">Create / Update Tenant Binding</h2>
        <TenantBindingForm onRefresh={handleRefresh} />
      </section>

      {/* Existing Tenants List */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100">Configured Tenants ({tenants.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Jules Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">GitHub Repo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Limit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Used</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tenants.map((tenant) => (
                <TenantRow key={tenant.id} tenant={tenant} onRefresh={handleRefresh} />
              ))}
            </tbody>
          </table>
        </div>
        {tenants.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No tenants configured. Create one above.
          </div>
        )}
      </section>
    </div>
  );
}