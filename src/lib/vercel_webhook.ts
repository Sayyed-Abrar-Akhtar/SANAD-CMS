import crypto from 'crypto';

/**
 * Verifies Vercel Webhook Signature.
 * Vercel sends: x-vercel-signature: v1=<signature>, t=<timestamp>
 * The signature is HMAC-SHA256 of `${timestamp}:${body}` using the webhook secret.
 */
export function verifyVercelSignature({
  secret,
  signatureHeader,
  rawBody,
}: {
  secret: string;
  signatureHeader: string | null;
  rawBody: string;
}): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }

  // Parse signature header: "v1=<signature>, t=<timestamp>"
  const parts = signatureHeader.split(',').map((s) => s.trim());
  const signaturePart = parts.find((p) => p.startsWith('v1='));
  const timestampPart = parts.find((p) => p.startsWith('t='));

  if (!signaturePart || !timestampPart) {
    return false;
  }

  const signature = signaturePart.slice(3); // Remove 'v1='
  const timestamp = timestampPart.slice(2); // Remove 't='

  // Prevent replay attacks (reject requests older than 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || Math.abs(currentTime - timestampNum) > 300) {
    return false;
  }

  // Verify HMAC-SHA256 of `${timestamp}:${body}`
  const message = `${timestamp}:${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}