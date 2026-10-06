import { NextRequest } from 'next/server';
import { fastroomManager, RoomEvent } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  const normalizedRoomId = roomId.trim().toLowerCase();
  const searchParams = request.nextUrl.searchParams;
  const isHost = searchParams.get('role') === 'host';

  const encoder = new TextEncoder();

  let isClosed = false;
  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const doCleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        if (unsubscribe) {
          try {
            unsubscribe();
          } catch {}
          unsubscribe = null;
        }

        try {
          controller.close();
        } catch {}
      };

      // 1. Send initial connected event
      try {
        const initialMsg = `data: ${JSON.stringify({ type: 'connected', roomId: normalizedRoomId })}\n\n`;
        controller.enqueue(encoder.encode(initialMsg));
      } catch {
        doCleanup();
        return;
      }

      // 2. Subscribe to room events
      unsubscribe = fastroomManager.subscribe(
        normalizedRoomId,
        (event: RoomEvent) => {
          if (isClosed) return;
          try {
            const payload = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch {
            // Client socket closed / broken pipe
            doCleanup();
          }
        },
        isHost
      );

      // 3. Heartbeat ping every 10 seconds to quickly detect dead sockets
      pingInterval = setInterval(() => {
        if (isClosed) {
          if (pingInterval) clearInterval(pingInterval);
          return;
        }
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`)
          );
        } catch {
          // Socket write failed -> client disconnected
          doCleanup();
        }
      }, 10000);

      // 4. Handle abort signal from Next.js request
      request.signal.addEventListener('abort', doCleanup);
    },
    cancel() {
      // Called immediately when client terminates or closes EventSource
      if (!isClosed) {
        isClosed = true;
        if (pingInterval) clearInterval(pingInterval);
        if (unsubscribe) {
          try {
            unsubscribe();
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
