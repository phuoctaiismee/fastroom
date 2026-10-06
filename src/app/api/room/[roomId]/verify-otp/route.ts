import { NextRequest, NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const body = await request.json();
    const { otp, deviceName, deviceId } = body;

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã OTP xác thực' },
        { status: 400 }
      );
    }

    const verification = fastroomManager.verifyOtp(
      roomId,
      otp,
      deviceName || 'Mobile Device',
      deviceId
    );

    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authToken: verification.authToken,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi xác thực OTP' },
      { status: 500 }
    );
  }
}
