import crypto from 'crypto';

/**
 * Verifies Slack Request Signature using HMAC-SHA256 according to Slack security specification.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature({
  signingSecret,
  requestSignature,
  requestTimestamp,
  rawBody,
}: {
  signingSecret: string;
  requestSignature: string;
  requestTimestamp: string;
  rawBody: string;
}): boolean {
  if (!signingSecret || !requestSignature || !requestTimestamp) {
    return false;
  }

  // Prevent replay attacks (reject requests older than 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const timeNum = parseInt(requestTimestamp, 10);
  if (isNaN(timeNum) || Math.abs(currentTime - timeNum) > 300) {
    return false;
  }

  const sigBaseString = `v0:${requestTimestamp}:${rawBody}`;
  const mySignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sigBaseString, 'utf8')
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(requestSignature, 'utf8')
  );
}

export async function triggerVercelDeployHook(): Promise<{ ok: boolean; message: string }> {
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

  if (process.env.NODE_ENV === 'test' || !deployHookUrl) {
    return { ok: true, message: 'Vercel deploy hook triggered (simulation)' };
  }

  try {
    const res = await fetch(deployHookUrl, { method: 'POST' });
    if (!res.ok) {
      return { ok: false, message: `Vercel deploy hook failed with status ${res.status}` };
    }
    return { ok: true, message: 'Vercel deploy hook triggered successfully' };
  } catch (err: any) {
    return { ok: false, message: `Vercel deploy hook request error: ${err.message}` };
  }
}
