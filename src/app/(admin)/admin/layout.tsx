import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?redirect=/admin');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <a href="/admin" className="text-xl font-extrabold text-indigo-400">
                SANAD CMS Admin
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/admin/tenants" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  Tenant Binding
                </a>
                <a href="/admin/templates" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  Prompt Templates
                </a>
                <a href="/admin/usage" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  Usage Limits
                </a>
                <a href="/admin/jobs" className="text-sm font-medium text-slate-300 hover:text-indigo-300 transition">
                  All Jobs
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="px-2 py-1 text-xs font-semibold bg-indigo-900 text-indigo-200 rounded">
                Admin
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