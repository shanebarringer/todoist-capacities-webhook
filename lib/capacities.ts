import type {
  TodoistTask,
  TodoistEventName,
  CapacitiesSaveToDailyNoteRequest,
} from './types.js';
import { getPriorityLabel } from './todoist.js';

const CAPACITIES_API_URL = 'https://api.capacities.io/save-to-daily-note';

/**
 * Save markdown text to the user's Capacities daily note
 */
export async function saveToDailyNote(
  mdText: string,
  apiToken: string,
  spaceId: string
): Promise<void> {
  const body: CapacitiesSaveToDailyNoteRequest = {
    spaceId,
    mdText,
    noTimeStamp: false, // Include timestamp for context
  };

  const response = await fetch(CAPACITIES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Capacities API error ${response.status}: ${errorText}`);
  }
}

/**
 * Format a Todoist task as rich markdown for Capacities daily note
 */
export function formatTaskAsMarkdown(
  task: TodoistTask,
  eventName: TodoistEventName
): string {
  const lines: string[] = [];

  switch (eventName) {
    case 'item:added':
      lines.push('### New Task Added');
      lines.push('');
      lines.push(`**${task.content}**`);
      break;

    case 'item:completed':
      lines.push('### Task Completed');
      lines.push('');
      lines.push(`~~${task.content}~~`);
      if (task.completed_at) {
        lines.push('');
        lines.push(`- **Completed:** ${formatDateTime(task.completed_at)}`);
      }
      return lines.join('\n') + '\n\n---\n';

    case 'item:updated':
      lines.push('### Task Updated');
      lines.push('');
      lines.push(`**${task.content}**`);
      break;

    case 'item:uncompleted':
      lines.push('### Task Reopened');
      lines.push('');
      lines.push(`**${task.content}**`);
      break;

    case 'item:deleted':
      lines.push('### Task Deleted');
      lines.push('');
      lines.push(`~~${task.content}~~`);
      return lines.join('\n') + '\n\n---\n';

    default:
      lines.push(`### Task Event: ${eventName}`);
      lines.push('');
      lines.push(`**${task.content}**`);
  }

  // Add metadata for non-completion events
  lines.push('');

  // Priority (skip if normal)
  if (task.priority > 1) {
    lines.push(`- **Priority:** ${getPriorityLabel(task.priority)}`);
  }

  // Due date
  if (task.due) {
    const dueStr = task.due.datetime
      ? formatDateTime(task.due.datetime)
      : task.due.date;
    const recurringNote = task.due.is_recurring ? ' (recurring)' : '';
    lines.push(`- **Due:** ${dueStr}${recurringNote}`);
  }

  // Labels
  if (task.labels && task.labels.length > 0) {
    lines.push(`- **Labels:** ${task.labels.join(', ')}`);
  }

  // Description
  if (task.description && task.description.trim()) {
    lines.push('');
    lines.push('> ' + task.description.split('\n').join('\n> '));
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format ISO datetime to human-readable format
 */
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}
