import { store } from '@/lib/store';
import { Tenant } from '@/types';
import { AdminTenantsClientWrapper } from './AdminTenantsClient';

export const dynamic = 'force-dynamic';

export default function AdminTenantsPage() {
  const tenants = store.getAllTenants();

  return <AdminTenantsClientWrapper initialTenants={tenants} />;
}