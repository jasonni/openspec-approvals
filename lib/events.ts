import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export type StreamEventType =
  | 'indexed'
  | 'approval_created'
  | 'sync_status'
  | 'artifact_updated'
  | 'connection_status';

export type StreamConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'synced' | 'retrying' | 'failed';

export type StreamEvent = {
  id: string;
  projectId: string;
  type: StreamEventType;
  message: string;
  createdAt: string;
  status?: StreamConnectionStatus;
  payload?: Record<string, unknown>;
};

const globalForEvents = globalThis as unknown as { events?: EventEmitter };

export const events = globalForEvents.events ?? new EventEmitter();
if (!globalForEvents.events) {
  globalForEvents.events = events;
}

export function emitStreamEvent(input: Omit<StreamEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): StreamEvent {
  const event: StreamEvent = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  events.emit('stream', event);
  return event;
}
