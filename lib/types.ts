// Todoist webhook event types
export type TodoistEventName =
  | 'item:added'
  | 'item:updated'
  | 'item:completed'
  | 'item:uncompleted'
  | 'item:deleted';

// Todoist priority: 4 = urgent (red), 3 = high, 2 = medium, 1 = normal
export type TodoistPriority = 1 | 2 | 3 | 4;

export interface TodoistDue {
  date: string;           // "2024-01-15" or "2024-01-15T14:00:00"
  timezone?: string;      // "America/New_York"
  string?: string;        // Human readable: "tomorrow at 2pm"
  lang?: string;
  is_recurring?: boolean;
  datetime?: string;      // ISO datetime if time is set
}

export interface TodoistTask {
  id: string;
  content: string;        // Task title
  description: string;    // Task description (body)
  project_id: string;
  section_id?: string;
  parent_id?: string;     // For subtasks
  priority: TodoistPriority;
  due?: TodoistDue;
  labels: string[];
  checked: boolean;       // true = completed
  is_deleted?: boolean;
  added_at?: string;
  completed_at?: string;
  user_id?: string;
}

export interface TodoistWebhookPayload {
  event_name: TodoistEventName;
  user_id: string;
  event_data: TodoistTask;
  initiator?: {
    email?: string;
    full_name?: string;
    id?: string;
  };
  version?: string;
}

// Capacities API types
export interface CapacitiesSaveToDailyNoteRequest {
  spaceId: string;
  mdText: string;
  origin?: 'commandPalette';
  noTimeStamp?: boolean;
}
