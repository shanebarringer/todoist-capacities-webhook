import { createHmac, timingSafeEqual } from 'crypto';
import type { TodoistWebhookPayload, TodoistPriority } from './types.js';

const TODOIST_HEADER = 'x-todoist-hmac-sha256';

/**
 * Verify the HMAC signature of a Todoist webhook request.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyTodoistSignature(
  rawBody: string,
  signature: string | undefined,
  clientSecret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', clientSecret)
    .update(rawBody)
    .digest('base64');

  // Use timing-safe comparison
  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Extract the HMAC signature from request headers.
 * Headers may be lowercase or have various casings.
 */
export function getSignatureFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  // Try common header casings
  const headerValue =
    headers[TODOIST_HEADER] ||
    headers['X-Todoist-Hmac-SHA256'] ||
    headers['X-TODOIST-HMAC-SHA256'];

  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return headerValue;
}

/**
 * Convert Todoist priority number to human-readable label
 */
export function getPriorityLabel(priority: TodoistPriority): string {
  const labels: Record<TodoistPriority, string> = {
    4: 'Urgent',
    3: 'High',
    2: 'Medium',
    1: 'Normal',
  };
  return labels[priority];
}

/**
 * Parse the webhook payload from request body
 */
export function parseWebhookPayload(body: string): TodoistWebhookPayload {
  return JSON.parse(body) as TodoistWebhookPayload;
}
