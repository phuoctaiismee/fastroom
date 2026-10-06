import { NextRequest } from 'next/server';
import { fastroomManager, RoomEvent, IS_REDIS_ENABLED, fetchRedisEvents, redisCommand } from '@/lib/room-store';

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
  let redisInterval: NodeJS.Timeout | null = null;

  // Track sent events to prevent duplicate emissions
  const sentEventKeys = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: RoomEvent & { _ts?: number }) => {
        if (isClosed) return;
        const key = `${event.type}_${'file' in event ? event.file.id : 'fileId' in event ? event.fileId : 'timestamp' in event ? event.timestamp : event._ts || ''}`;
        if (sentEventKeys.has(key)) return;
        sentEventKeys.add(key);

        if (sentEventKeys.size > 100) {
          const first = sentEventKeys.values().next().value;
          if (first) sentEventKeys.delete(first);
        }

        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          doCleanup();
        }
      };

      const doCleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        if (redisInterval) {
          clearInterval(redisInterval);
          redisInterval = null;
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

      // 2. Local process memory subscription
      unsubscribe = fastroomManager.subscribe(
        normalizedRoomId,
        (event: RoomEvent) => {
          sendEvent(event);
        },
        isHost
      );

      // 3. Cross-serverless Redis polling subscription (if Redis enabled)
      let lastRedisIndex = 0;
      if (IS_REDIS_ENABLED) {
        try {
          const len = await redisCommand<number>(['LLEN', `fastroom:events:${normalizedRoomId}`]);
          if (typeof len === 'number') {
            lastRedisIndex = Math.max(0, len - 5); // Read last 5 events for instant sync
          }
        } catch {}

        redisInterval = setInterval(async () => {
          if (isClosed) return;
          try {
            const events = await fetchRedisEvents(normalizedRoomId, lastRedisIndex);
            if (events.length > 0) {
              lastRedisIndex += events.length;
              for (const ev of events) {
                sendEvent(ev);
              }
            }
          } catch {}
        }, 1000);
      }

      // 4. Heartbeat ping every 10 seconds to quickly detect dead sockets
      pingInterval = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`)
          );
        } catch {
          doCleanup();
        }
      }, 10000);

      // 5. Handle abort signal from Next.js request
      request.signal.addEventListener('abort', doCleanup);
    },
    cancel() {
      if (!isClosed) {
        isClosed = true;
        if (pingInterval) clearInterval(pingInterval);
        if (redisInterval) clearInterval(redisInterval);
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
