import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/lib/store';
import { getCustomerStatus } from '@/types';

describe('Store and Domain Models', () => {
  beforeEach(() => {
    store.reset();
  });

  it('should initialize and retrieve tenants', () => {
    const tenant = store.getTenant('tenant-demo');
    expect(tenant).toBeUndefined(); // reset cleared it

    store.saveTenant({
      id: 'tenant-1',
      name: 'Tenant 1',
      jules_source_name: 'sources/github-acme',
      github_owner: 'acme',
      github_repo: 'web',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const retrieved = store.getTenant('tenant-1');
    expect(retrieved?.name).toBe('Tenant 1');
  });

  it('should acquire and release repo locks correctly', () => {
    const repoKey = 'acme/web';
    const lock1 = store.acquireRepoLock(repoKey, 'job-1');
    expect(lock1).toBe(true);

    // Another job trying to acquire lock on same repo
    const lock2 = store.acquireRepoLock(repoKey, 'job-2');
    expect(lock2).toBe(false);

    // Re-acquiring by same job
    const lock1Again = store.acquireRepoLock(repoKey, 'job-1');
    expect(lock1Again).toBe(true);

    // Release lock
    store.releaseRepoLock(repoKey, 'job-1');
    const lock2AfterRelease = store.acquireRepoLock(repoKey, 'job-2');
    expect(lock2AfterRelease).toBe(true);
  });

  it('should map internal job state to customer status per specification', () => {
    expect(getCustomerStatus('queued')).toBe('Working…');
    expect(getCustomerStatus('interpreting')).toBe('Working…');
    expect(getCustomerStatus('generating_code')).toBe('Working…');
    expect(getCustomerStatus('needs_input')).toBe('Working… (+ internal alert)');
    expect(getCustomerStatus('pending_review')).toBe('Working…');
    expect(getCustomerStatus('rejected')).toBe('Not approved');
    expect(getCustomerStatus('done')).toBe('Done ✅');
    expect(getCustomerStatus('failed')).toBe('Couldn\'t complete — try rephrasing');
  });
});
