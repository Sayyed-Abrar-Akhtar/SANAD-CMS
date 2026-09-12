import { store } from '@/lib/store';
import { refineInputToBlueprint, incrementTenantUsage } from '@/lib/guardrails';
import { createJulesSession, getJulesSession, sendJulesFeedback, extractPRFromSession } from '@/lib/jules';
import { sendSlackReviewNotification } from '@/lib/slack';
import { InternalJobState } from '@/types';

/**
 * Background worker to process CMS request job queue.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job) return;

  const tenant = store.getTenant(job.tenantId);
  if (!tenant) {
    job.internalState = 'failed';
    job.failureReason = 'Tenant missing or deleted.';
    store.saveJob(job);
    return;
  }

  const repoKey = `${tenant.github_owner}/${tenant.github_repo}`;

  // Enforce per-repo locking to prevent concurrent conflict PRs
  if (!store.acquireRepoLock(repoKey, jobId)) {
    // Re-queue or wait if repo is currently locked
    setTimeout(() => processJob(jobId), 1000);
    return;
  }

  try {
    // Step 2: Guardrails & Refinement
    job.internalState = 'interpreting';
    store.saveJob(job);
    store.addAuditLog({ jobId, tenantId: tenant.id, action: 'JOB_INTERPRETING' });

    const refinement = await refineInputToBlueprint(job.rawInput, job.format, tenant);

    if (!refinement.allowed || !refinement.blueprint) {
      job.internalState = 'failed';
      job.failureReason = refinement.rejectReason || 'Input rejected by guardrails.';
      store.saveJob(job);
      store.releaseRepoLock(repoKey, jobId);
      store.addAuditLog({
        jobId,
        tenantId: tenant.id,
        action: 'JOB_FAILED_GUARDRAILS',
        details: { reason: job.failureReason },
      });
      return;
    }

    job.blueprint = refinement.blueprint;
    job.internalState = 'generating_code';
    store.saveJob(job);

    // Increment tenant monthly quota usage count upon starting code generation session
    incrementTenantUsage(tenant.id);

    // Step 3: Jules Session Invocation
    const julesSession = await createJulesSession({
      jobId: job.jobId,
      tenant,
      blueprint: job.blueprint,
    });

    job.julesSessionId = julesSession.name;
    job.julesState = julesSession.state;
    store.saveJob(job);
    store.addAuditLog({
      jobId,
      tenantId: tenant.id,
      action: 'JULES_SESSION_CREATED',
      details: { sessionId: julesSession.name, state: julesSession.state },
    });

    // Step 4: Poll Jules Session status until terminal state or review required
    await pollJulesSession(jobId, repoKey);
  } catch (err: any) {
    job.internalState = 'failed';
    job.failureReason = `Orchestrator error: ${err.message}`;
    store.saveJob(job);
    store.releaseRepoLock(repoKey, jobId);
    store.addAuditLog({
      jobId,
      tenantId: tenant.id,
      action: 'JOB_ERROR',
      details: { error: err.message },
    });
  }
}

async function pollJulesSession(jobId: string, repoKey: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job || !job.julesSessionId) return;

  const tenant = store.getTenant(job.tenantId);
  let pollAttempts = 0;

  while (pollAttempts < 30) {
    pollAttempts++;

    try {
      const session = await getJulesSession(job.julesSessionId);
      job.julesState = session.state;

      if (session.state === 'AWAITING_USER_FEEDBACK') {
        // Auto-answer via sendMessage if answer exists in blueprint
        const autoAnswer = `Please proceed strictly according to the blueprint specification: ${JSON.stringify(
          job.blueprint
        )}`;
        await sendJulesFeedback(job.julesSessionId, autoAnswer);
        store.addAuditLog({
          jobId,
          tenantId: job.tenantId,
          action: 'JULES_AUTO_ANSWERED_FEEDBACK',
          details: { answer: autoAnswer },
        });
      } else if (session.state === 'COMPLETED') {
        // Jules finished and created PR
        const prInfo = extractPRFromSession(session);
        if (prInfo) {
          job.pullRequest = prInfo;
          job.internalState = 'pending_review';
          store.saveJob(job);

          store.addAuditLog({
            jobId,
            tenantId: job.tenantId,
            action: 'JULES_COMPLETED_PR_CREATED',
            details: { prInfo },
          });

          // Step 5: Send Slack review notification
          if (tenant) {
            await sendSlackReviewNotification({
              rawUserPrompt: job.rawInput,
              tenantName: tenant.name,
              prUrl: prInfo.url,
              prNumber: prInfo.number,
              jobId: job.jobId,
            });
          }
        } else {
          job.internalState = 'failed';
          job.failureReason = 'Jules session completed but did not produce a PR output.';
          store.saveJob(job);
          store.releaseRepoLock(repoKey, jobId);
        }
        return;
      } else if (session.state === 'FAILED') {
        job.internalState = 'failed';
        job.failureReason = 'Jules coding session failed during build or test execution.';
        store.saveJob(job);
        store.releaseRepoLock(repoKey, jobId);
        return;
      } else {
        // Still in QUEUED, PLANNING, or IN_PROGRESS
        store.saveJob(job);
      }
    } catch (err: any) {
      console.error(`Error polling Jules session ${job.julesSessionId}:`, err);
    }

    if (process.env.NODE_ENV === 'test') {
      // Don't sleep during tests
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
