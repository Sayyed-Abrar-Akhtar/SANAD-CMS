import { Job, Tenant, PullRequestInfo } from '@/types';

export interface SlackNotificationPayload {
  rawUserPrompt: string;
  tenantName: string;
  prUrl: string;
  prNumber: number;
  jobId: string;
}

export function buildSlackReviewBlockKit(payload: SlackNotificationPayload): Record<string, any> {
  return {
    text: '🚨 AI CMS Change Pending Review',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🛠️ Build Succeeded — Ready for Review',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User Prompt:*\n"${payload.rawUserPrompt}"`,
          },
          {
            type: 'mrkdwn',
            text: `*Tenant:*\n${payload.tenantName}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*PR:*\n<${payload.prUrl}>`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Approve & Merge ✅',
            },
            style: 'primary',
            value: `merge_pr_${payload.prNumber}_job_${payload.jobId}`,
            action_id: 'approve_cms_change',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Reject & Close ❌',
            },
            style: 'danger',
            value: `close_pr_${payload.prNumber}_job_${payload.jobId}`,
            action_id: 'reject_cms_change',
          },
        ],
      },
    ],
  };
}

export async function sendSlackReviewNotification(
  payload: SlackNotificationPayload
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  const blockKit = buildSlackReviewBlockKit(payload);

  if (process.env.NODE_ENV === 'test' || !webhookUrl) {
    console.log('[Slack Simulation] Sent notification:', JSON.stringify(blockKit, null, 2));
    return true;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blockKit),
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to send Slack notification:', err);
    return false;
  }
}
