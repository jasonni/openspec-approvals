import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { events } from '@/lib/events';
import { getProject } from '@/lib/projects';
import type { StreamEvent } from '@/lib/events';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!getProject(projectId)) {
    return new Response(JSON.stringify({ error: `Unknown projectId: ${projectId}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  ensureProjectBootstrapped(projectId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const onEvent = (event: StreamEvent) => {
        if (isClosed || event.projectId !== projectId) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (error) {
          isClosed = true;
        }
      };
      events.on('stream', onEvent);

      const heartbeat = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (error) {
          isClosed = true;
          clearInterval(heartbeat);
        }
      }, 15000);

      const cleanup = () => {
        isClosed = true;
        clearInterval(heartbeat);
        events.off('stream', onEvent);
      };

      const connectedEvent: StreamEvent = {
        id: `connection:${projectId}:${Date.now()}`,
        projectId,
        type: 'connection_status',
        status: 'connected',
        message: `Live stream connected for ${projectId}`,
        createdAt: new Date().toISOString(),
        payload: { projectId, status: 'connected' },
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(connectedEvent)}\n\n`)
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
