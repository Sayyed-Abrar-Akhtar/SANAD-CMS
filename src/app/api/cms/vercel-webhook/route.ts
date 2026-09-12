import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Vercel deployment event webhook handling
    // Expected Vercel event types: "deployment.succeeded" | "deployment.error" | "deployment.created"
    const eventType = body.type || body.event;
    const deploymentPayload = body.payload || body;
    const deploymentId = deploymentPayload.id || deploymentPayload.deploymentId;
    const deploymentUrl = deploymentPayload.url ? `https://${deploymentPayload.url}` : undefined;

    // Locate job by deployment ID or find active merged_pending_deploy job for tenant
    const jobs = Array.from(store['jobs'].values());
    const pendingJob =
      jobs.find((j) => j.deployment?.id === deploymentId) ||
      jobs.find((j) => j.internalState === 'merged_pending_deploy');

    if (!pendingJob) {
      return NextResponse.json(
        { message: 'Webhook received, but no matching pending deployment job found.' },
        { status: 200 }
      );
    }

    const tenant = store.getTenant(pendingJob.tenantId);
    const repoKey = tenant ? `${tenant.github_owner}/${tenant.github_repo}` : undefined;

    if (eventType === 'deployment.succeeded') {
      // Step 7 & 8: Deploy finished -> mark job as done
      pendingJob.deployment = {
        id: deploymentId,
        url: deploymentUrl,
        status: 'succeeded',
      };
      pendingJob.internalState = 'done';
      store.saveJob(pendingJob);

      // Release per-repo queue lock upon final completion
      if (repoKey) {
        store.releaseRepoLock(repoKey, pendingJob.jobId);
      }

      store.addAuditLog({
        jobId: pendingJob.jobId,
        tenantId: pendingJob.tenantId,
        action: 'VERCEL_DEPLOYMENT_SUCCEEDED_JOB_DONE',
        details: { deploymentId, deploymentUrl },
      });

      return NextResponse.json({
        message: `Deployment ${deploymentId} succeeded. Job ${pendingJob.jobId} marked as done ✅`,
      });
    } else if (eventType === 'deployment.error') {
      pendingJob.deployment = {
        id: deploymentId,
        url: deploymentUrl,
        status: 'error',
      };
      pendingJob.internalState = 'failed';
      pendingJob.failureReason = 'Vercel deployment failed after PR merge.';
      store.saveJob(pendingJob);

      if (repoKey) {
        store.releaseRepoLock(repoKey, pendingJob.jobId);
      }

      store.addAuditLog({
        jobId: pendingJob.jobId,
        tenantId: pendingJob.tenantId,
        action: 'VERCEL_DEPLOYMENT_FAILED',
        details: { deploymentId },
      });

      return NextResponse.json({
        message: `Deployment ${deploymentId} failed. Job ${pendingJob.jobId} marked as failed.`,
      });
    }

    return NextResponse.json({ message: `Vercel event ${eventType} acknowledged.` });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
