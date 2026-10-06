import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  const activeFiles = fastroomManager.getActiveFiles(roomId);

  return NextResponse.json({
    roomId,
    files: activeFiles,
    connectedCount: fastroomManager.getConnectedClientsCount(roomId),
  });
}
