import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifySlackSignature } from '@/lib/slack_interactivity';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';
import { POST as slackPost } from '@/app/api/cms/slack-interactivity/route';

describe('Slack Interactivity Route & Signature Verification', () => {
  const secret = 'test-signing-secret';

  beforeEach(() => {
    store.reset();
    store.saveTenant({
      id: 'tenant-slack-test',
      name: 'Slack Test Tenant',
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
      jobId: 'job-slack-101',
      tenantId: 'tenant-slack-test',
      userId: 'user-1',
      format: 'text',
      rawInput: 'Test request',
      internalState: 'pending_review',
      pullRequest: {
        url: 'https://github.com/acme/web/pull/15',
        number: 15,
        branch: 'jules/patch-15',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.acquireRepoLock('acme/web', 'job-slack-101');
  });

  it('should verify valid HMAC-SHA256 Slack signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = 'payload=%7B%22test%22%3Atrue%7D';
    const sigBaseString = `v0:${timestamp}:${rawBody}`;
    const mySignature =
      'v0=' +
      crypto
        .createHmac('sha256', secret)
        .update(sigBaseString, 'utf8')
        .digest('hex');

    const isValid = verifySlackSignature({
      signingSecret: secret,
      requestSignature: mySignature,
      requestTimestamp: timestamp,
      rawBody,
    });

    expect(isValid).toBe(true);
  });

  it('should reject expired timestamp (older than 5 minutes)', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const rawBody = 'payload=%7B%22test%22%3Atrue%7D';
    const sigBaseString = `v0:${oldTimestamp}:${rawBody}`;
    const mySignature =
      'v0=' +
      crypto
        .createHmac('sha256', secret)
        .update(sigBaseString, 'utf8')
        .digest('hex');

    const isValid = verifySlackSignature({
      signingSecret: secret,
      requestSignature: mySignature,
      requestTimestamp: oldTimestamp,
      rawBody,
    });

    expect(isValid).toBe(false);
  });

  it('should process approve_cms_change action and transition state to merged_pending_deploy', async () => {
    const payloadStr = JSON.stringify({
      actions: [
        {
          action_id: 'approve_cms_change',
          value: 'merge_pr_15_job_job-slack-101',
        },
      ],
    });

    const body = `payload=${encodeURIComponent(payloadStr)}`;
    const req = new NextRequest('http://localhost:3000/api/cms/slack-interactivity', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const res = await slackPost(req);
    expect(res.status).toBe(200);

    const resJson = await res.json();
    expect(resJson.text).toContain('Approved & Merged!');

    const updatedJob = store.getJob('job-slack-101');
    expect(updatedJob?.internalState).toBe('merged_pending_deploy');
  });

  it('should process reject_cms_change action, close PR, update state to rejected and release repo lock', async () => {
    const payloadStr = JSON.stringify({
      actions: [
        {
          action_id: 'reject_cms_change',
          value: 'close_pr_15_job_job-slack-101',
        },
      ],
    });

    const body = `payload=${encodeURIComponent(payloadStr)}`;
    const req = new NextRequest('http://localhost:3000/api/cms/slack-interactivity', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const res = await slackPost(req);
    expect(res.status).toBe(200);

    const resJson = await res.json();
    expect(resJson.text).toContain('Rejected & Closed');

    const updatedJob = store.getJob('job-slack-101');
    expect(updatedJob?.internalState).toBe('rejected');
    expect(store.isRepoLocked('acme/web')).toBe(false);
  });
});
