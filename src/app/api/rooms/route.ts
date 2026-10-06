import { NextResponse } from 'next/server';
import { fastroomManager } from '@/lib/room-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rooms = await fastroomManager.getAvailableRoomsAsync();
    return NextResponse.json({
      success: true,
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
