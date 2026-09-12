import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getCustomerStatus } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = store.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendUpdate = () => {
        if (isClosed) return;
        const currentJob = store.getJob(jobId);
        if (!currentJob) return;

        const customerStatus = getCustomerStatus(
          currentJob.internalState,
          currentJob.julesState
        );

        const eventData = JSON.stringify({
          jobId: currentJob.jobId,
          internalState: currentJob.internalState,
          customerStatus,
          julesState: currentJob.julesState,
          pullRequest: currentJob.pullRequest,
          deployment: currentJob.deployment,
          failureReason: currentJob.failureReason,
          updatedAt: currentJob.updatedAt,
        });

        controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));

        if (
          currentJob.internalState === 'done' ||
          currentJob.internalState === 'rejected' ||
          currentJob.internalState === 'failed'
        ) {
          isClosed = true;
          controller.close();
        }
      };

      // Send initial state immediately
      sendUpdate();

      // Poll store state periodically for changes
      const interval = setInterval(() => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }
        sendUpdate();
      }, 1000);

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
