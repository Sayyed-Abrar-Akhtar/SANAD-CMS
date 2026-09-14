import { cookies } from 'next/headers';
import { store } from '@/lib/store';
import { Tenant } from '@/types';

export type UserRole = 'platform_admin' | 'customer';

export interface SessionUser {
  userId: string;
  role: UserRole;
  tenantId?: string;
  email?: string;
  name?: string;
}

const SESSION_COOKIE_NAME = 'cms_session';

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value) as SessionUser;
    return sessionData;
  } catch {
    return null;
  }
}

export function createSessionToken(user: SessionUser): string {
  return JSON.stringify(user);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== 'platform_admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return session;
}

export async function requireCustomer(): Promise<{ session: SessionUser; tenant: Tenant }> {
  const session = await requireAuth();
  if (session.role !== 'customer') {
    throw new Error('Forbidden: Customer access required');
  }
  if (!session.tenantId) {
    throw new Error('Customer session missing tenantId');
  }
  const tenant = store.getTenant(session.tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  return { session, tenant };
}

export async function getTenantForSession(): Promise<Tenant | null> {
  const session = await getSession();
  if (!session?.tenantId) return null;
  return store.getTenant(session.tenantId) || null;
}