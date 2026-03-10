import { ensureBootstrapped } from '@/lib/bootstrap';
import { events } from '@/lib/events';
import type { StreamEvent } from '@/lib/events';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  ensureBootstrapped();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onEvent = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      events.on('stream', onEvent);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        events.off('stream', onEvent);
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'indexed', message: 'stream_connected' })}\n\n`)
      );

      // @ts-expect-error close callback is valid in web stream controller in runtime
      controller.oncancel = cleanup;
    },
    cancel() {
      // no-op; listener cleanup handled in start via oncancel
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
