'use client';

import { useEffect, useState } from 'react';
import { mergeRealtimeNotifications } from '@/lib/stream-events';

type StreamEvent = {
  id: string;
  type: 'indexed' | 'approval_created' | 'sync_status' | 'artifact_updated' | 'connection_status';
  message: string;
  createdAt?: string;
  status?: 'connected' | 'disconnected' | 'reconnecting' | 'synced' | 'retrying' | 'failed';
};

export function EventStatus({ projectId }: { projectId: string }): React.ReactElement {
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>(
    'connecting'
  );
  const [notifications, setNotifications] = useState<StreamEvent[]>([]);

  useEffect(() => {
    const source = new EventSource(`/api/stream?projectId=${encodeURIComponent(projectId)}`);
    setConnection('connecting');

    source.onopen = () => {
      setConnection('connected');
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamEvent;
        if (event.type === 'connection_status') {
          setConnection((event.status as 'connected' | 'disconnected' | 'reconnecting' | undefined) ?? 'connected');
          return;
        }
        setNotifications((previous) => mergeRealtimeNotifications(previous, event, 5));
      } catch {
        setConnection('reconnecting');
      }
    };

    source.onerror = () => {
      setConnection('reconnecting');
    };

    return () => {
      setConnection('disconnected');
      source.close();
    };
  }, [projectId]);

  return (
    <div className="grid" aria-live="polite">
      <p className="muted live-status">
        <span className={`connection-dot ${connection}`} aria-hidden />
        Live stream: <strong>{connection}</strong>
      </p>
      <div className="grid">
        {notifications.length === 0 ? <p className="muted">Waiting for realtime updates…</p> : null}
        {notifications.map((event) => (
          <p key={event.id} className="muted" style={{ margin: 0 }}>
            <strong>{event.type}</strong> - {event.message}
          </p>
        ))}
      </div>
    </div>
  );
}
