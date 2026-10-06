import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ roomId: string; fileId: string }> }
) {
  const { roomId, fileId } = await context.params;
  const removed = fastroomManager.removeFile(roomId, fileId);

  return NextResponse.json({
    success: removed,
    roomId,
    fileId,
  });
}

// PATCH { pinned: boolean } -> pin / unpin a file (synced to every device via SSE)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ roomId: string; fileId: string }> }
) {
  const { roomId, fileId } = await context.params;

  let pinned: unknown;
  try {
    ({ pinned } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof pinned !== 'boolean') {
    return NextResponse.json({ error: '`pinned` must be a boolean' }, { status: 400 });
  }

  const file = fastroomManager.setFilePinned(roomId, fileId, pinned);
  if (!file) {
    return NextResponse.json({ error: 'File không tồn tại hoặc đã hết hạn' }, { status: 404 });
  }

  return NextResponse.json({ success: true, file });
}
