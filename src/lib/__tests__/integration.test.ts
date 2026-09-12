import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';
import { POST as bindPost } from '@/app/api/cms/tenants/bind/route';
import { POST as requestsPost } from '@/app/api/cms/requests/route';
import { POST as slackPost } from '@/app/api/cms/slack-interactivity/route';
import { POST as vercelPost } from '@/app/api/cms/vercel-webhook/route';
import { getCustomerStatus } from '@/types';

describe('End-to-End Orchestrator Integration Pipeline', () => {
  beforeEach(() => {
    store.reset();
  });

  it('should process full successful lifecycle: Bind -> Intake -> Jules -> Slack Approve -> Vercel Deploy -> Done', async () => {
    // 1. Bind Tenant
    const bindReq = new NextRequest('http://localhost:3000/api/cms/tenants/bind', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-e2e',
        name: 'E2E Tenant',
        julesSourceName: 'sources/github-e2e-storefront',
        githubOwner: 'e2e-org',
        githubRepo: 'e2e-repo',
        defaultBranch: 'main',
        monthlyLimit: 5,
      }),
    });

    const bindRes = await bindPost(bindReq);
    expect(bindRes.status).toBe(200);

    const tenant = store.getTenant('tenant-e2e');
    expect(tenant?.status).toBe('active');

    // 2. Submit CMS Request
    const intakeReq = new NextRequest('http://localhost:3000/api/cms/requests', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'x-tenant-id': 'tenant-e2e',
        'x-idempotency-key': 'e2e-idemp-1',
      },
      body: 'Update hero banner title to "Summer Sale 2026"',
    });

    const intakeRes = await requestsPost(intakeReq);
    expect(intakeRes.status).toBe(202);
    const intakeBody = await intakeRes.json();
    const jobId = intakeBody.jobId;

    // Wait for worker execution (ran synchronously in test)
    const jobAfterWorker = store.getJob(jobId);
    expect(jobAfterWorker?.internalState).toBe('pending_review');
    expect(jobAfterWorker?.pullRequest?.number).toBe(42);
    expect(getCustomerStatus(jobAfterWorker!.internalState)).toBe('Working…');

    // 3. Admin clicks Approve & Merge in Slack
    const slackApprovePayload = JSON.stringify({
      actions: [
        {
          action_id: 'approve_cms_change',
          value: `merge_pr_42_job_${jobId}`,
        },
      ],
    });

    const slackReq = new NextRequest('http://localhost:3000/api/cms/slack-interactivity', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `payload=${encodeURIComponent(slackApprovePayload)}`,
    });

    const slackRes = await slackPost(slackReq);
    expect(slackRes.status).toBe(200);

    const jobAfterApprove = store.getJob(jobId);
    expect(jobAfterApprove?.internalState).toBe('merged_pending_deploy');

    // 4. Vercel deployment succeeds webhook
    const vercelPayload = {
      type: 'deployment.succeeded',
      payload: {
        id: 'dpl_e2e_99',
        url: 'e2e-storefront.vercel.app',
      },
    };

    const vercelReq = new NextRequest('http://localhost:3000/api/cms/vercel-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(vercelPayload),
    });

    const vercelRes = await vercelPost(vercelReq);
    expect(vercelRes.status).toBe(200);

    const finalJob = store.getJob(jobId);
    expect(finalJob?.internalState).toBe('done');
    expect(getCustomerStatus(finalJob!.internalState)).toBe('Done ✅');
    expect(store.isRepoLocked('e2e-org/e2e-repo')).toBe(false);
  });

  it('should handle Slack rejection lifecycle cleanly', async () => {
    // Setup active tenant
    store.saveTenant({
      id: 'tenant-reject',
      name: 'Reject Tenant',
      jules_source_name: 'sources/github-reject',
      github_owner: 'org',
      github_repo: 'repo',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Intake request
    const intakeReq = new NextRequest('http://localhost:3000/api/cms/requests', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'x-tenant-id': 'tenant-reject',
      },
      body: 'Update pricing table',
    });

    const intakeRes = await requestsPost(intakeReq);
    const { jobId } = await intakeRes.json();

    // Admin clicks Reject in Slack
    const slackRejectPayload = JSON.stringify({
      actions: [
        {
          action_id: 'reject_cms_change',
          value: `close_pr_42_job_${jobId}`,
        },
      ],
    });

    const slackReq = new NextRequest('http://localhost:3000/api/cms/slack-interactivity', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `payload=${encodeURIComponent(slackRejectPayload)}`,
    });

    await slackPost(slackReq);

    const rejectedJob = store.getJob(jobId);
    expect(rejectedJob?.internalState).toBe('rejected');
    expect(getCustomerStatus(rejectedJob!.internalState)).toBe('Not approved');
    expect(store.isRepoLocked('org/repo')).toBe(false);
  });
});
