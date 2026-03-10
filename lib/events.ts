import { EventEmitter } from 'node:events';

export type StreamEvent = {
  type: 'indexed' | 'approval_created' | 'sync_status';
  message: string;
  payload?: Record<string, unknown>;
};

const globalForEvents = globalThis as unknown as { events?: EventEmitter };

export const events = globalForEvents.events ?? new EventEmitter();
if (!globalForEvents.events) {
  globalForEvents.events = events;
}
