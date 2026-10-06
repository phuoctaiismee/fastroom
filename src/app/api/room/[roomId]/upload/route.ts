import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const body = await request.json();

    const { id, name, type, size, dataUrl, senderDevice, senderName, senderDeviceId } = body;

    if (!dataUrl || !name) {
      return NextResponse.json(
        { error: 'Missing file data or name' },
        { status: 400 }
      );
    }

    // Safety check for dataUrl size: 35MB base64 max
    if (typeof dataUrl === 'string' && dataUrl.length > 35 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed 25MB' },
        { status: 413 }
      );
    }

    const file = fastroomManager.addFile(roomId, {
      id: id || `f_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      name,
      type: type || 'application/octet-stream',
      size: Number(size) || 0,
      dataUrl,
      senderDevice: senderDevice || 'Web Client',
      senderName,
      senderDeviceId,
    });

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        createdAt: file.createdAt,
        expiresAt: file.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    );
  }
}
