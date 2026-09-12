import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature, triggerVercelDeployHook } from '@/lib/slack_interactivity';
import { mergeGitHubPR, closeGitHubPR } from '@/lib/github';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const slackSignature = req.headers.get('x-slack-signature') || '';
    const slackTimestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signingSecret = process.env.SLACK_SIGNING_SECRET || 'mock-slack-signing-secret';

    // 1. Verify Slack Request Signature unless in bypass simulation mode
    if (process.env.NODE_ENV !== 'test' && signingSecret !== 'mock-slack-signing-secret') {
      const isValid = verifySlackSignature({
        signingSecret,
        requestSignature: slackSignature,
        requestTimestamp: slackTimestamp,
        rawBody,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid Slack signature or request timestamp expired' },
          { status: 401 }
        );
      }
    }

    // 2. Parse payload from Slack application/x-www-form-urlencoded
    const params = new URLSearchParams(rawBody);
    const payloadJsonStr = params.get('payload');

    if (!payloadJsonStr) {
      return NextResponse.json({ error: 'Missing Slack payload param' }, { status: 400 });
    }

    const payload = JSON.parse(payloadJsonStr);
    const action = payload.actions?.[0];

    if (!action) {
      return NextResponse.json({ error: 'No action found in Slack payload' }, { status: 400 });
    }

    const actionId = action.action_id; // "approve_cms_change" | "reject_cms_change"
    const actionValue = action.value || ''; // e.g., "merge_pr_42_job_job-123" or "close_pr_42_job_job-123"

    // Parse pull number and jobId from button action value
    const match = actionValue.match(/^(merge|close)_pr_(\d+)_job_(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: `Invalid action value format: ${actionValue}` },
        { status: 400 }
      );
    }

    const pullNumber = parseInt(match[2], 10);
    const jobId = match[3];

    const job = store.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 });
    }

    const tenant = store.getTenant(job.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: `Tenant ${job.tenantId} not found` }, { status: 404 });
    }

    const repoKey = `${tenant.github_owner}/${tenant.github_repo}`;

    if (actionId === 'approve_cms_change') {
      // Step 6: Merge PR via GitHub REST API
      const mergeResult = await mergeGitHubPR(
        tenant.github_owner,
        tenant.github_repo,
        pullNumber
      );

      if (!mergeResult.ok) {
        return NextResponse.json({ text: `❌ Failed to merge PR: ${mergeResult.message}` });
      }

      // Step 7: Transition to merged_pending_deploy & trigger Vercel deploy hook
      job.internalState = 'merged_pending_deploy';
      store.saveJob(job);
      store.addAuditLog({
        jobId,
        tenantId: tenant.id,
        action: 'SLACK_APPROVED_PR_MERGED',
        details: { pullNumber, mergeResult },
      });

      const deployResult = await triggerVercelDeployHook();

      return NextResponse.json({
        text: `✅ *Approved & Merged!* PR #${pullNumber} merged into \`${tenant.default_branch}\`. Vercel deployment triggered: ${deployResult.message}`,
      });
    } else if (actionId === 'reject_cms_change') {
      // Step 6: Close PR via GitHub REST API & reject job
      const closeResult = await closeGitHubPR(
        tenant.github_owner,
        tenant.github_repo,
        pullNumber
      );

      job.internalState = 'rejected';
      job.failureReason = 'Admin rejected change request in Slack.';
      store.saveJob(job);

      // Release repo lock on rejection
      store.releaseRepoLock(repoKey, jobId);

      store.addAuditLog({
        jobId,
        tenantId: tenant.id,
        action: 'SLACK_REJECTED_PR_CLOSED',
        details: { pullNumber, closeResult },
      });

      return NextResponse.json({
        text: `❌ *Rejected & Closed.* PR #${pullNumber} closed and job marked as rejected.`,
      });
    }

    return NextResponse.json({ error: `Unknown action_id: ${actionId}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
