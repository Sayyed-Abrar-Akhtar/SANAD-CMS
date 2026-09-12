import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { validateAndParseInput } from '@/lib/intake';
import { Job, InputFormat } from '@/types';
import { processJob } from '@/lib/worker';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || 'text/plain';
    const tenantId = req.headers.get('x-tenant-id') || 'tenant-demo';
    const userId = req.headers.get('x-user-id') || 'user-anonymous';
    const idempotencyKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingJob = store.getJobByIdempotencyKey(idempotencyKey);
      if (existingJob) {
        return NextResponse.json(
          {
            jobId: existingJob.jobId,
            status: existingJob.internalState,
            message: 'Duplicate request detected. Returning existing job.',
          },
          { status: 202 }
        );
      }
    }

    // 2. Tenant validation
    const tenant = store.getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found or invalid tenant ID' },
        { status: 404 }
      );
    }

    if (tenant.status !== 'active') {
      return NextResponse.json(
        { error: 'Tenant setup incomplete. Please bind tenant to a Jules source first.' },
        { status: 400 }
      );
    }

    // 3. Read raw input string
    const rawInput = await req.text();

    // 4. Validate and Parse Input Server-Side
    const searchParams = req.nextUrl.searchParams;
    const formatParam = searchParams.get('format') || undefined;

    const parseResult = validateAndParseInput(rawInput, contentType, formatParam);

    if (!parseResult.valid) {
      return NextResponse.json(
        {
          error: 'Invalid input format or schema error',
          errors: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // 5. Persist job in 'queued' state BEFORE anything else
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const job: Job = {
      jobId,
      tenantId,
      userId,
      format: parseResult.format as InputFormat,
      rawInput,
      idempotencyKey: idempotencyKey || undefined,
      internalState: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveJob(job);

    if (idempotencyKey) {
      store.setIdempotencyKey(idempotencyKey, jobId);
    }

    store.addAuditLog({
      jobId,
      tenantId,
      action: 'JOB_INTAKE_QUEUED',
      details: { format: job.format, userId },
    });

    const initialStatus = job.internalState;

    // Hand off asynchronously to queue worker (non-blocking)
    processJob(jobId).catch((err) => {
      console.error(`Background worker error processing job ${jobId}:`, err);
    });

    // 6. Respond 202 Accepted immediately with { jobId }
    return NextResponse.json(
      {
        jobId,
        status: initialStatus,
        message: 'Request accepted and queued for orchestration.',
      },
      { status: 202 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
