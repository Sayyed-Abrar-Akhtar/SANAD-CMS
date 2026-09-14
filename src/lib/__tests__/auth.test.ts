import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSession, createSessionToken, requireAuth, requireAdmin, requireCustomer, setSessionCookie, clearSessionCookie } from '@/lib/auth';
import { store } from '@/lib/store';

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('Auth Module', () => {
  beforeEach(() => {
    store.reset();
    store.saveTenant({
      id: 'tenant-auth-test',
      name: 'Auth Test Tenant',
      jules_source_name: 'sources/github-test',
      github_owner: 'acme',
      github_repo: 'web',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    vi.clearAllMocks();
  });

  it('should create and parse session token correctly', () => {
    const user = {
      userId: 'user-123',
      role: 'platform_admin' as const,
      email: 'admin@example.com',
      name: 'Admin User',
    };

    const token = createSessionToken(user);
    const parsed = JSON.parse(token);
    
    expect(parsed.userId).toBe(user.userId);
    expect(parsed.role).toBe(user.role);
    expect(parsed.email).toBe(user.email);
    expect(parsed.name).toBe(user.name);
  });

  it('should create customer session with tenantId', () => {
    const user = {
      userId: 'user-456',
      role: 'customer' as const,
      tenantId: 'tenant-auth-test',
      email: 'customer@example.com',
      name: 'Customer User',
    };

    const token = createSessionToken(user);
    const parsed = JSON.parse(token);
    
    expect(parsed.tenantId).toBe(user.tenantId);
  });

  it('should return null when no session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('should parse valid session cookie', async () => {
    const user = {
      userId: 'user-789',
      role: 'customer' as const,
      tenantId: 'tenant-auth-test',
      email: 'user@example.com',
      name: 'Test User',
    };
    const token = createSessionToken(user);
    
    mockCookieStore.get.mockReturnValue({ value: token });
    
    const session = await getSession();
    expect(session).toEqual(user);
  });

  it('should throw on requireAuth when no session', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    
    await expect(requireAuth()).rejects.toThrow('Unauthorized');
  });

  it('should throw on requireAdmin when role is customer', async () => {
    const user = {
      userId: 'user-customer',
      role: 'customer' as const,
      tenantId: 'tenant-auth-test',
      email: 'customer@example.com',
    };
    const token = createSessionToken(user);
    
    mockCookieStore.get.mockReturnValue({ value: token });
    
    await expect(requireAdmin()).rejects.toThrow('Forbidden: Admin access required');
  });

  it('should return session on requireAdmin when role is platform_admin', async () => {
    const user = {
      userId: 'user-admin',
      role: 'platform_admin' as const,
      email: 'admin@example.com',
    };
    const token = createSessionToken(user);
    
    mockCookieStore.get.mockReturnValue({ value: token });
    
    const session = await requireAdmin();
    expect(session).toEqual(user);
  });

  it('should throw on requireCustomer when role is platform_admin', async () => {
    const user = {
      userId: 'user-admin',
      role: 'platform_admin' as const,
      email: 'admin@example.com',
    };
    const token = createSessionToken(user);
    
    mockCookieStore.get.mockReturnValue({ value: token });
    
    await expect(requireCustomer()).rejects.toThrow('Forbidden: Customer access required');
  });

  it('should return session and tenant on requireCustomer', async () => {
    const user = {
      userId: 'user-customer',
      role: 'customer' as const,
      tenantId: 'tenant-auth-test',
      email: 'customer@example.com',
    };
    const token = createSessionToken(user);
    
    mockCookieStore.get.mockReturnValue({ value: token });
    
    const { session, tenant } = await requireCustomer();
    expect(session).toEqual(user);
    expect(tenant.id).toBe('tenant-auth-test');
  });

  it('should set session cookie', async () => {
    const user = {
      userId: 'user-cookie',
      role: 'customer' as const,
      tenantId: 'tenant-auth-test',
      email: 'cookie@example.com',
    };
    
    await setSessionCookie(user);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'cms_session',
      createSessionToken(user),
      expect.any(Object)
    );
  });

  it('should clear session cookie', async () => {
    await clearSessionCookie();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('cms_session');
  });
});