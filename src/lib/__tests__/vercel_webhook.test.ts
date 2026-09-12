import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';
import { POST as vercelWebhookPost } from '@/app/api/cms/vercel-webhook/route';

describe('Vercel Webhook Endpoint', () => {
  beforeEach(() => {
    store.reset();
    store.saveTenant({
      id: 'tenant-vercel',
      name: 'Vercel Tenant',
      jules_source_name: 'sources/github-test',
      github_owner: 'acme',
      github_repo: 'storefront',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.saveJob({
      jobId: 'job-vercel-1',
      tenantId: 'tenant-vercel',
      userId: 'user-1',
      format: 'text',
      rawInput: 'Update storefront',
      internalState: 'merged_pending_deploy',
      deployment: { id: 'dpl_123', status: 'pending' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.acquireRepoLock('acme/storefront', 'job-vercel-1');
  });

  it('should mark job as done on deployment.succeeded event and release repo lock', async () => {
    const payload = {
      type: 'deployment.succeeded',
      payload: {
        id: 'dpl_123',
        url: 'storefront-acme.vercel.app',
      },
    };

    const req = new NextRequest('http://localhost:3000/api/cms/vercel-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await vercelWebhookPost(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toContain('marked as done');

    const updatedJob = store.getJob('job-vercel-1');
    expect(updatedJob?.internalState).toBe('done');
    expect(updatedJob?.deployment?.status).toBe('succeeded');
    expect(store.isRepoLocked('acme/storefront')).toBe(false);
  });

  it('should mark job as failed on deployment.error event and release repo lock', async () => {
    const payload = {
      type: 'deployment.error',
      payload: {
        id: 'dpl_123',
      },
    };

    const req = new NextRequest('http://localhost:3000/api/cms/vercel-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await vercelWebhookPost(req);
    expect(res.status).toBe(200);

    const updatedJob = store.getJob('job-vercel-1');
    expect(updatedJob?.internalState).toBe('failed');
    expect(store.isRepoLocked('acme/storefront')).toBe(false);
  });
});
