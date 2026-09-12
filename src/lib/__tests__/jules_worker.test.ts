import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '@/lib/store';
import { processJob } from '@/lib/worker';
import { createJulesSession, extractPRFromSession } from '@/lib/jules';
import { buildSlackReviewBlockKit } from '@/lib/slack';
import { Tenant, Job } from '@/types';

describe('Jules API & Worker Module', () => {
  const mockTenant: Tenant = {
    id: 'tenant-jules-test',
    name: 'Jules Test Tenant',
    jules_source_name: 'sources/github-jules-test',
    github_owner: 'acme',
    github_repo: 'storefront',
    default_branch: 'main',
    status: 'active',
    monthly_limit: 5,
    used_count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    store.reset();
    store.saveTenant(mockTenant);
  });

  it('should format Jules session creation payload correctly without forcing fixed branch name', async () => {
    const session = await createJulesSession({
      jobId: 'job-101',
      tenant: mockTenant,
      blueprint: {
        targets: [{ page: '/', component: 'Hero', property: 'title', value: 'New Banner' }],
        summary: 'Update hero',
        riskFlags: [],
      },
    });

    expect(session.name).toContain('job-101');
    expect(session.state).toBe('QUEUED');
  });

  it('should extract PR information from Jules session outputs', () => {
    const mockSessionResponse = {
      name: 'sessions/12345',
      state: 'COMPLETED',
      outputs: [
        {
          pullRequest: {
            url: 'https://github.com/acme/storefront/pull/12',
            number: 12,
            branch: 'jules/patch-12',
          },
        },
      ],
    };

    const pr = extractPRFromSession(mockSessionResponse);
    expect(pr).toBeDefined();
    expect(pr?.number).toBe(12);
    expect(pr?.url).toBe('https://github.com/acme/storefront/pull/12');
  });

  it('should build valid Slack Block Kit payload with approve and reject buttons', () => {
    const slackPayload = buildSlackReviewBlockKit({
      rawUserPrompt: 'Update hero title to Welcome',
      tenantName: 'Jules Test Tenant',
      prUrl: 'https://github.com/acme/storefront/pull/12',
      prNumber: 12,
      jobId: 'job-101',
    });

    expect(slackPayload.text).toContain('AI CMS Change Pending Review');
    const actions = slackPayload.blocks.find((b: any) => b.type === 'actions');
    expect(actions).toBeDefined();
    expect(actions.elements).toHaveLength(2);
    expect(actions.elements[0].action_id).toBe('approve_cms_change');
    expect(actions.elements[1].action_id).toBe('reject_cms_change');
  });

  it('should process job end-to-end and hold repo lock during pending_review', async () => {
    const job: Job = {
      jobId: 'job-worker-test',
      tenantId: mockTenant.id,
      userId: 'user-1',
      format: 'text',
      rawInput: 'Update footer link text',
      internalState: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveJob(job);

    await processJob(job.jobId);

    const updatedJob = store.getJob(job.jobId);
    expect(updatedJob?.internalState).toBe('pending_review');
    expect(updatedJob?.pullRequest?.number).toBe(42);
    // Lock is held while pending review
    expect(store.isRepoLocked('acme/storefront')).toBe(true);
  });
});
