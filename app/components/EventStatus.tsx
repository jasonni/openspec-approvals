'use client';

import { useEffect, useState } from 'react';

type StreamEvent = {
  type: 'indexed' | 'approval_created' | 'sync_status';
  message: string;
};

export function EventStatus(): React.ReactElement {
  const [event, setEvent] = useState<StreamEvent | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/stream');
    source.onmessage = (message) => {
      try {
        setEvent(JSON.parse(message.data) as StreamEvent);
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      source.close();
    };
  }, []);

  if (!event) {
    return <p className="muted">Live stream: connecting...</p>;
  }

  return (
    <p className="muted">
      Live stream: <strong>{event.type}</strong> - {event.message}
    </p>
  );
}
