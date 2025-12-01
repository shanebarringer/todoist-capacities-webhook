/**
 * One-time script to register a webhook with Todoist.
 *
 * Usage:
 *   1. Set environment variables in .env.local
 *   2. Deploy your webhook to Vercel first: vercel --prod
 *   3. Run: pnpm register-webhook
 *
 * Required env vars:
 *   - TODOIST_CLIENT_ID
 *   - TODOIST_CLIENT_SECRET
 *   - WEBHOOK_URL (your deployed Vercel URL + /api/webhook)
 */

import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const TODOIST_WEBHOOK_API = 'https://api.todoist.com/sync/v9/webhooks';

interface WebhookResponse {
  id?: string;
  url?: string;
  events?: string[];
  error?: string;
}

async function registerWebhook(): Promise<void> {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;
  const webhookUrl = process.env.WEBHOOK_URL;

  // Validate required environment variables
  if (!clientId) {
    console.error('Error: TODOIST_CLIENT_ID is not set');
    process.exit(1);
  }
  if (!clientSecret) {
    console.error('Error: TODOIST_CLIENT_SECRET is not set');
    process.exit(1);
  }
  if (!webhookUrl) {
    console.error('Error: WEBHOOK_URL is not set');
    console.error('Set it to your deployed Vercel URL + /api/webhook');
    console.error('Example: https://your-app.vercel.app/api/webhook');
    process.exit(1);
  }

  // Events to subscribe to
  const events = [
    'item:added',
    'item:updated',
    'item:completed',
    'item:uncompleted',
    'item:deleted',
  ];

  console.log('Registering webhook with Todoist...');
  console.log(`  URL: ${webhookUrl}`);
  console.log(`  Events: ${events.join(', ')}`);

  try {
    const response = await fetch(TODOIST_WEBHOOK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        url: webhookUrl,
        events: JSON.stringify(events),
      }),
    });

    const data = (await response.json()) as WebhookResponse;

    if (!response.ok) {
      console.error('Failed to register webhook:');
      console.error(`  Status: ${response.status}`);
      console.error(`  Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

    console.log('\nWebhook registered successfully!');
    console.log(`  Webhook ID: ${data.id}`);
    console.log(`  URL: ${data.url}`);
    console.log(`  Events: ${data.events?.join(', ')}`);
    console.log('\nYour Todoist tasks will now sync to Capacities!');
  } catch (error) {
    console.error('Error registering webhook:', error);
    process.exit(1);
  }
}

// List existing webhooks
async function listWebhooks(): Promise<void> {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing TODOIST_CLIENT_ID or TODOIST_CLIENT_SECRET');
    process.exit(1);
  }

  console.log('Fetching existing webhooks...\n');

  const response = await fetch(
    `${TODOIST_WEBHOOK_API}?client_id=${clientId}&client_secret=${clientSecret}`
  );

  const data = await response.json();
  console.log('Existing webhooks:', JSON.stringify(data, null, 2));
}

// Main
const command = process.argv[2];

if (command === 'list') {
  listWebhooks();
} else {
  registerWebhook();
}
