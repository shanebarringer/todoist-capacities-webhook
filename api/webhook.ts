// Edge runtime gives us access to raw request body
export const config = {
  runtime: 'edge',
};

const SUPPORTED_EVENTS = new Set([
  'item:added',
  'item:updated',
  'item:completed',
  'item:uncompleted',
  'item:deleted',
]);

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  priority: 1 | 2 | 3 | 4;
  due?: { date: string; datetime?: string; is_recurring?: boolean };
  labels: string[];
  checked: boolean;
  completed_at?: string;
}

interface TodoistWebhookPayload {
  event_name: string;
  user_id: string;
  event_data: TodoistTask;
}

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  return expected === signature;
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = { 4: 'Urgent', 3: 'High', 2: 'Medium', 1: 'Normal' };
  return labels[priority] || 'Normal';
}

function formatTaskMarkdown(task: TodoistTask, eventName: string): string {
  const lines: string[] = [];

  if (eventName === 'item:completed') {
    lines.push('### Task Completed', '', `~~${task.content}~~`);
    if (task.completed_at) {
      lines.push('', `- **Completed:** ${new Date(task.completed_at).toLocaleString()}`);
    }
  } else if (eventName === 'item:added') {
    lines.push('### New Task Added', '', `**${task.content}**`);
  } else if (eventName === 'item:updated') {
    lines.push('### Task Updated', '', `**${task.content}**`);
  } else {
    lines.push(`### Task Event: ${eventName}`, '', `**${task.content}**`);
  }

  if (eventName !== 'item:completed') {
    if (task.priority > 1) lines.push(`- **Priority:** ${getPriorityLabel(task.priority)}`);
    if (task.due) {
      const dueStr = task.due.datetime || task.due.date;
      lines.push(`- **Due:** ${dueStr}${task.due.is_recurring ? ' (recurring)' : ''}`);
    }
    if (task.labels?.length) lines.push(`- **Labels:** ${task.labels.join(', ')}`);
    if (task.description?.trim()) lines.push('', '> ' + task.description.split('\n').join('\n> '));
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

export default async function handler(request: Request): Promise<Response> {
  console.log('Webhook called:', request.method, request.url);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const clientSecret = process.env.TODOIST_CLIENT_SECRET;
  const capacitiesToken = process.env.CAPACITIES_API_TOKEN;
  const spaceId = process.env.CAPACITIES_SPACE_ID;

  console.log('Env check:', {
    hasClientSecret: !!clientSecret,
    hasCapacitiesToken: !!capacitiesToken,
    hasSpaceId: !!spaceId,
    spaceIdLength: spaceId?.length,
    tokenLength: capacitiesToken?.length,
  });

  if (!clientSecret || !capacitiesToken || !spaceId) {
    console.error('Missing env vars');
    return new Response(JSON.stringify({ error: 'Server config error' }), { status: 500 });
  }

  // Get raw body text from Edge request
  const rawBody = await request.text();
  const signature = request.headers.get('x-todoist-hmac-sha256');

  console.log('Raw body length:', rawBody.length);
  console.log('Signature:', signature);

  // TEMPORARY: Skip signature verification for debugging
  const isValidSig = await verifySignature(rawBody, signature, clientSecret);
  console.log('Signature valid:', isValidSig);
  // if (!isValidSig) {
  //   console.warn('Invalid signature');
  //   return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  // }

  let payload: TodoistWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { event_name, event_data } = payload;

  if (!SUPPORTED_EVENTS.has(event_name)) {
    return new Response(JSON.stringify({ status: 'ignored', event: event_name }), { status: 200 });
  }

  const markdown = formatTaskMarkdown(event_data, event_name);

  try {
    const res = await fetch('https://api.capacities.io/save-to-daily-note', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${capacitiesToken}`,
      },
      body: JSON.stringify({ spaceId, mdText: markdown }),
    });

    const responseText = await res.text();
    console.log('Capacities response:', { status: res.status, body: responseText });

    if (!res.ok) {
      console.error('Capacities error:', res.status, responseText);
      return new Response(JSON.stringify({ error: 'Capacities API error', details: responseText }), { status: 500 });
    }

    console.log(`Synced ${event_name}: ${event_data.content}`);
    return new Response(JSON.stringify({ status: 'ok', event: event_name }), { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500 });
  }
}
