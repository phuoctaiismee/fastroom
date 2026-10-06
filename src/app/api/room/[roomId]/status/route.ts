import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const deviceId = request.nextUrl.searchParams.get('deviceId');
    const claimHost = request.nextUrl.searchParams.get('claimHost') === 'true';

    const status = await fastroomManager.getRoomStatusAsync(roomId, deviceId, claimHost);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error checking room status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
