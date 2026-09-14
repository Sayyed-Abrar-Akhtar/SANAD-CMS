import { redirect } from 'next/navigation';
import { requireCustomer, getTenantForSession } from '@/lib/auth';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  let tenant;
  try {
    const result = await requireCustomer();
    tenant = result.tenant;
  } catch {
    redirect('/login?redirect=/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <a href="/dashboard" className="text-xl font-extrabold text-indigo-400">
                SANAD CMS
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  Submit Change
                </a>
                <a href="/dashboard/history" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  Request History
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-400">{tenant.name}</span>
              <span className="px-2 py-1 text-xs font-semibold bg-emerald-900 text-emerald-200 rounded">
                Customer
              </span>
            </div>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}