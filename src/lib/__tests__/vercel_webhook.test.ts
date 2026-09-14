import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifyVercelSignature } from '@/lib/vercel_webhook';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';
import { POST as vercelPost } from '@/app/api/cms/vercel-webhook/route';

describe('Vercel Webhook Route & Signature Verification', () => {
  const secret = 'test-vercel-webhook-secret';

  beforeEach(() => {
    store.reset();
    store.saveTenant({
      id: 'tenant-vercel-test',
      name: 'Vercel Test Tenant',
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

    store.saveJob({
      jobId: 'job-vercel-101',
      tenantId: 'tenant-vercel-test',
      userId: 'user-1',
      format: 'text',
      rawInput: 'Test request',
      internalState: 'merged_pending_deploy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.acquireRepoLock('acme/web', 'job-vercel-101');
  });

  it('should verify valid HMAC-SHA256 Vercel signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({
      type: 'deployment.succeeded',
      payload: { id: 'dpl_test123', url: 'test-project.vercel.app' },
    });
    // Vercel signs `${timestamp}:${body}`
    const message = `${timestamp}:${rawBody}`;
    const mySignature = crypto
      .createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('hex');

    const signatureHeader = `v1=${mySignature}, t=${timestamp}`;
    const isValid = verifyVercelSignature({
      secret,
      signatureHeader,
      rawBody,
    });

    expect(isValid).toBe(true);
  });

  it('should reject expired timestamp (older than 5 minutes)', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const rawBody = JSON.stringify({ type: 'deployment.succeeded', payload: { id: 'dpl_test' } });
    const message = `${oldTimestamp}:${rawBody}`;
    const mySignature = crypto
      .createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('hex');

    const signatureHeader = `v1=${mySignature}, t=${oldTimestamp}`;
    const isValid = verifyVercelSignature({
      secret,
      signatureHeader,
      rawBody,
    });

    expect(isValid).toBe(false);
  });

  it('should process deployment.succeeded and mark job as done, releasing repo lock', async () => {
    const rawBody = JSON.stringify({
      type: 'deployment.succeeded',
      payload: { id: 'dpl_test123', url: 'test-project.vercel.app' },
    });

    const req = new NextRequest('http://localhost:3000/api/cms/vercel-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vercel-signature': `v1=invalid, t=${Math.floor(Date.now() / 1000)}`, // Invalid signature but test mode bypasses
      },
      body: rawBody,
    });

    const res = await vercelPost(req);
    expect(res.status).toBe(200);

    const resJson = await res.json();
    expect(resJson.message).toContain('succeeded');
    expect(resJson.message).toContain('done');

    const updatedJob = store.getJob('job-vercel-101');
    expect(updatedJob?.internalState).toBe('done');
    expect(updatedJob?.deployment?.status).toBe('succeeded');
    expect(store.isRepoLocked('acme/web')).toBe(false);
  });

  it('should process deployment.error and mark job as failed', async () => {
    const rawBody = JSON.stringify({
      type: 'deployment.error',
      payload: { id: 'dpl_test456', url: 'test-project.vercel.app' },
    });

    const req = new NextRequest('http://localhost:3000/api/cms/vercel-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vercel-signature': `v1=invalid, t=${Math.floor(Date.now() / 1000)}`, // Invalid signature but test mode bypasses
      },
      body: rawBody,
    });

    const res = await vercelPost(req);
    expect(res.status).toBe(200);

    const resJson = await res.json();
    expect(resJson.message).toContain('failed');

    const updatedJob = store.getJob('job-vercel-101');
    expect(updatedJob?.internalState).toBe('failed');
    expect(updatedJob?.deployment?.status).toBe('error');
    expect(store.isRepoLocked('acme/web')).toBe(false);
  });
});