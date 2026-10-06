import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  fastroomManager.clearRoom(roomId);

  return NextResponse.json({
    success: true,
    roomId,
  });
}
