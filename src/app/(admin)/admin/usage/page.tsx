import { store } from '@/lib/store';
import { Job, Tenant } from '@/types';
import AdminUsageClient from './AdminUsageClient';

export const dynamic = 'force-dynamic';

export default function AdminUsagePage() {
  const tenants = store.getAllTenants();

  // Calculate usage stats per tenant
  const tenantStats = tenants.map((tenant) => {
    const jobs = store.getJobsByTenant(tenant.id);
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const jobsThisMonth = jobs.filter((j) => j.createdAt.startsWith(currentMonth));
    const submittedCount = jobsThisMonth.length;
    const shippedCount = jobsThisMonth.filter((j) => j.internalState === 'done').length;
    const remaining = Math.max(0, tenant.monthly_limit - tenant.used_count);

    return {
      tenant,
      submittedCount,
      shippedCount,
      remaining,
      usedCount: tenant.used_count,
      limit: tenant.monthly_limit,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100">Usage Limits & Quotas</h1>
          <p className="text-slate-400 mt-1">
            Per-tenant monthly limits. Admin can adjust limits per tenant. Tracks both requests submitted and changes shipped.
          </p>
        </div>
      </div>

      <AdminUsageClient initialStats={tenantStats} />
    </div>
  );
}