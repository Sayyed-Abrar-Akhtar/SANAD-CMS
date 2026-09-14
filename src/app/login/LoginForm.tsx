'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [role, setRole] = useState<'platform_admin' | 'customer'>('customer');
  const [tenantId, setTenantId] = useState('tenant-demo');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tenants = [
    { id: 'tenant-demo', name: 'Acme Storefront Tenant' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, tenantId: role === 'customer' ? tenantId : undefined, email, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-indigo-400">SANAD CMS</h1>
          <p className="text-slate-400 mt-2">Sign in to continue</p>
        </div>

        {error && (
          <div className="bg-rose-900/30 border border-rose-500 text-rose-300 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'platform_admin' | 'customer')}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
            >
              <option value="customer">Customer</option>
              <option value="platform_admin">Platform Admin</option>
            </select>
          </div>

          {role === 'customer' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100"
              placeholder="Your Name"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 font-medium py-3 rounded text-sm transition disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Demo mode: No real authentication. Choose role and tenant to continue.
        </p>
      </div>
    </div>
  );
}