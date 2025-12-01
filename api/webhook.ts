import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import {
  verifyTodoistSignature,
  getSignatureFromHeaders,
  parseWebhookPayload,
} from '../lib/todoist.js';
import { formatTaskAsMarkdown, saveToDailyNote } from '../lib/capacities.js';

// Events we want to handle
const SUPPORTED_EVENTS = new Set([
  'item:added',
  'item:updated',
  'item:completed',
  'item:uncompleted',
  'item:deleted',
]);

/**
 * Read the raw request body as a string
 */
async function getRawBody(req: VercelRequest): Promise<string> {
  // If body is already available (Vercel may pre-parse even with bodyParser: false)
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf-8');
  }
  if (req.body && typeof req.body === 'object') {
    // Already parsed as JSON - stringify back (may differ from original)
    return JSON.stringify(req.body);
  }

  // Read from stream
  const chunks: Buffer[] = [];
  const readable = req as unknown as Readable;

  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get required environment variables
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;
  const capacitiesToken = process.env.CAPACITIES_API_TOKEN;
  const spaceId = process.env.CAPACITIES_SPACE_ID;

  if (!clientSecret || !capacitiesToken || !spaceId) {
    console.error('Missing required environment variables');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // Get raw body for HMAC verification
  const rawBody = await getRawBody(req);

  // Verify HMAC signature
  const signature = getSignatureFromHeaders(
    req.headers as Record<string, string | string[] | undefined>
  );

  if (!verifyTodoistSignature(rawBody, signature, clientSecret)) {
    console.warn('Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Parse the webhook payload
  let payload;
  try {
    payload = parseWebhookPayload(rawBody);
  } catch (error) {
    console.error('Failed to parse webhook payload:', error);
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const { event_name, event_data } = payload;

  // Check if this is an event we handle
  if (!SUPPORTED_EVENTS.has(event_name)) {
    // Acknowledge but don't process
    res.status(200).json({ status: 'ignored', event: event_name });
    return;
  }

  // Format the task as markdown
  const markdown = formatTaskAsMarkdown(event_data, event_name);

  // Send to Capacities
  try {
    await saveToDailyNote(markdown, capacitiesToken, spaceId);
    console.log(`Successfully synced ${event_name} for task: ${event_data.content}`);
    res.status(200).json({ status: 'ok', event: event_name });
  } catch (error) {
    console.error('Failed to save to Capacities:', error);
    res.status(500).json({ error: 'Failed to save to Capacities' });
  }
}

// Disable body parsing to get raw body for HMAC verification
export const config = {
  api: {
    bodyParser: false,
  },
};
