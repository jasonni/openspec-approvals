export type RealtimeNotification = {
  id?: string;
  type: string;
  message: string;
  createdAt?: string;
};

export function eventIdentity(event: RealtimeNotification): string {
  return event.id || `${event.type}:${event.message}:${event.createdAt ?? ''}`;
}

export function mergeRealtimeNotifications<T extends RealtimeNotification>(
  existing: T[],
  incoming: T,
  limit = 5
): T[] {
  const incomingKey = eventIdentity(incoming);
  if (existing.some((event) => eventIdentity(event) === incomingKey)) {
    return existing;
  }
  return [incoming, ...existing].slice(0, limit);
}
