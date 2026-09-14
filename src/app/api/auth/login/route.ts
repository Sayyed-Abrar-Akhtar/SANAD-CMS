import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookie, SessionUser } from '@/lib/auth';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, tenantId, email, name } = body;

    if (!role || !['platform_admin', 'customer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be platform_admin or customer' }, { status: 400 });
    }

    const sessionData: SessionUser = {
      userId: email || `user-${Date.now()}`,
      role: role as 'platform_admin' | 'customer',
      email,
      name: name || email || 'User',
    };

    if (role === 'customer') {
      if (!tenantId) {
        return NextResponse.json({ error: 'tenantId required for customer role' }, { status: 400 });
      }
      const tenant = store.getTenant(tenantId);
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      sessionData.tenantId = tenantId;
    }

    const response = NextResponse.json({ success: true, user: sessionData });
    await setSessionCookie(sessionData);
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}