import { RoomView } from '@/components/RoomView';
import type { Metadata } from 'next';

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Phòng ${roomId} - Fastroom Realtime`,
    description: `Kho tạm thời realtime cho phòng ${roomId}. Tự hủy sau 5 phút.`,
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <RoomView roomId={roomId} />;
}
