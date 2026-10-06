import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  const isHost = request.nextUrl.searchParams.get('role') === 'host';
  const otpData = fastroomManager.getRoomOtp(roomId, isHost);

  return NextResponse.json({
    roomId,
    otp: otpData.otp,
    expiresAt: otpData.expiresAt,
    remainingSeconds: otpData.remainingSeconds,
  });
}
