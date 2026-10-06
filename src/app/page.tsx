'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  ArrowRight,
  Dices,
  Hash,
  History,
  Radio,
  PlusCircle,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { AvailableRoomsSheet } from '@/components/AvailableRoomsSheet';
import { AvailableRoomSummary } from '@/lib/room-store';

const MAX_ROOM_LENGTH = 24;

const ROOM_WORDS = [
  'nhanh',
  'sieu-toc',
  'test',
  'bug',
  'snap',
  'qa',
  'live',
  'fast',
  'dev',
  'agent',
  'room',
  'shot',
];

function getRandomRoomName(current?: string): string {
  let name = '';
  let count = 0;
  do {
    const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    name = `${word}-${num}`;
    count++;
  } while (name === current && count < 10);
  return name;
}

// Convert Vietnamese text with accents to ASCII slug with hyphens (e.g. "phòng này là của tôi" -> "phong-nay-la-cua-toi")
export function parseRoomSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, '') // Chỉ giữ chữ, số, gạch ngang, khoảng trắng
    .replace(/\s+/g, '-') // Đổi khoảng trắng thành gạch ngang
    .replace(/-+/g, '-') // Gộp nhiều gạch ngang liên tiếp
    .slice(0, MAX_ROOM_LENGTH); // Giới hạn tối đa 24 ký tự
}

const ROLL_DURATION_MS = 750;

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // TanStack Query for available rooms with auto-refresh and shared cache
  const { data: availableRooms = [] } = useQuery<AvailableRoomSummary[]>({
    queryKey: ['available-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      return Array.isArray(data.rooms) ? data.rooms : [];
    },
    refetchInterval: 4000,
  });

  // Initialize with a random room name and load recent rooms only on client mount
  useEffect(() => {
    setMounted(true);
    setRoomName(getRandomRoomName());
    try {
      const stored = localStorage.getItem('fastroom_recent_rooms');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentRooms(parsed.slice(0, 4));
      }
    } catch {
      // Ignore localStorage errors
    }
    // Auto-focus input without causing SSR hydration mismatch
    inputRef.current?.focus();
  }, []);

  const handleRollRandom = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent spamming while spinning
    if (isPending) return;
    setIsPending(true);

    setRoomName((prev) => getRandomRoomName(prev));

    setTimeout(() => {
      setIsPending(false);
    }, ROLL_DURATION_MS);
  };

  const handleJoinOrCreate = (targetRoom?: string) => {
    const raw = targetRoom || roomName;
    const cleanRoom = parseRoomSlug(raw).replace(/^-+|-+$/g, '');

    if (!cleanRoom) {
      toast.error('Vui lòng nhập tên phòng');
      return;
    }

    // Save to recents
    try {
      const updated = [cleanRoom, ...recentRooms.filter((r) => r !== cleanRoom)].slice(0, 4);
      localStorage.setItem('fastroom_recent_rooms', JSON.stringify(updated));
    } catch {
      // Ignore
    }

    // Direct navigation that works on both desktop and mobile IP
    if (typeof window !== 'undefined') {
      window.location.href = `/room/${cleanRoom}`;
    } else {
      router.push(`/room/${cleanRoom}`);
    }
  };

  const cleanCurrentSlug = parseRoomSlug(roomName).replace(/^-+|-+$/g, '');
  const matchingAvailableRoom = availableRooms.find((r) => r.roomId === cleanCurrentSlug);
  const isCurrentRoomOnline = !!matchingAvailableRoom;

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-3 sm:p-4 bg-neutral-50/50 text-neutral-900 selection:bg-neutral-900 selection:text-white overflow-hidden">
      <div className="w-full max-w-md space-y-4 sm:space-y-5">
        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-950 flex items-center justify-center text-white shadow-md shadow-neutral-950/10 transition-transform hover:scale-105">
            <Zap className="size-6 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Fastroom
            </h1>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              Kho ảnh tạm realtime • Tự hủy 5 phút • Mã OTP 60s
            </p>
          </div>
        </div>

        {/* Live Available Rooms Bar */}
        <div className="flex items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSheetOpen(true)}
            className="h-8 px-3.5 rounded-full gap-2 text-xs font-medium border-border/80 bg-white hover:bg-neutral-100 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {availableRooms.length > 0
                ? `${availableRooms.length} phòng đang online`
                : 'Danh sách phòng đang mở'}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" />
          </Button>
        </div>

        {/* Premium Action Card */}
        <Card className="p-5 sm:p-6 bg-white border-neutral-200/80 shadow-xl shadow-neutral-200/50 rounded-2xl space-y-4 sm:space-y-5">
          <form
            action="javascript:void(0)"
            onSubmit={(e) => {
              e.preventDefault();
              handleJoinOrCreate();
            }}
            className="space-y-4"
          >
            {/* Input with Dice roll button */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                <span>Tên phòng</span>
                <span suppressHydrationWarning className="text-[10px] font-mono text-neutral-400">
                  {roomName.length}/{MAX_ROOM_LENGTH} ký tự
                </span>
              </label>

              <div className="relative flex items-center">
                <Hash className="size-4 text-neutral-400 absolute left-3.5 pointer-events-none z-10" />
                <Input
                  ref={inputRef}
                  suppressHydrationWarning
                  type="text"
                  value={roomName}
                  maxLength={MAX_ROOM_LENGTH}
                  onChange={(e) => {
                    const parsed = parseRoomSlug(e.target.value);
                    setRoomName(parsed);
                  }}
                  onBlur={() => {
                    setRoomName((prev) => prev.replace(/^-+|-+$/g, ''));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleJoinOrCreate();
                    }
                  }}
                  placeholder="nhap-ten-phong"
                  className="pl-9 pr-12 h-12 text-base font-mono font-medium rounded-xl border-neutral-200 focus-visible:ring-neutral-950 focus-visible:border-neutral-950 bg-neutral-50/50"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRollRandom}
                  title={isPending ? 'Đang đổi tên...' : 'Bấm để đổi tên phòng ngẫu nhiên khác'}
                  className={`z-20 absolute right-2 p-2 rounded-lg transition-all ${
                    isPending
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 active:scale-95'
                  }`}
                >
                  <Dices
                    className={`size-5 text-neutral-600 ${isPending ? 'animate-spin-once' : ''}`}
                  />
                </button>
              </div>

              {/* Status helper text under input */}
              <div className="min-h-[18px] flex items-center">
                {cleanCurrentSlug && (
                  isCurrentRoomOnline ? (
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Phòng này đang online trên máy tính ({matchingAvailableRoom.fileCount} ảnh, {matchingAvailableRoom.clientsCount} kết nối)
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-neutral-300"></span>
                      Chưa có ai mở — Nhấn để tạo phòng mới này
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Main Action Button */}
            <Button
              type="button"
              onClick={() => handleJoinOrCreate()}
              size="lg"
              className={`w-full h-12 rounded-xl text-white font-medium text-sm gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer ${
                isCurrentRoomOnline
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-neutral-950 hover:bg-neutral-800 shadow-neutral-950/10'
              }`}
            >
              {isCurrentRoomOnline ? (
                <>
                  <LogIn className="size-4" />
                  <span>Tham gia phòng ngay</span>
                </>
              ) : (
                <>
                  <PlusCircle className="size-4" />
                  <span>Tạo & Mở phòng mới</span>
                </>
              )}
              <ArrowRight className="size-4 ml-auto" />
            </Button>
          </form>

          {/* Recent Rooms */}
          {mounted && recentRooms.length > 0 && (
            <div className="pt-3 border-t border-neutral-100 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <History className="size-3" />
                  <span>Phòng vừa truy cập:</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentRooms.map((recent) => {
                  const isOnline = availableRooms.some((r) => r.roomId === recent);
                  return (
                    <Badge
                      key={recent}
                      variant="secondary"
                      onClick={() => handleJoinOrCreate(recent)}
                      className={`cursor-pointer text-xs font-mono font-normal py-1 px-2.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        isOnline
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 hover:text-neutral-900 border-transparent'
                      }`}
                    >
                      {isOnline && <span className="size-1.5 rounded-full bg-emerald-500"></span>}
                      #{recent}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Minimal helper footnote */}
        <p className="text-center text-[11px] text-neutral-400 font-mono">
          Quét mã QR từ điện thoại • Không cần cài app
        </p>
      </div>

      {/* Available Rooms Drawer / Sheet */}
      <AvailableRoomsSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSelectRoom={(targetRoom) => handleJoinOrCreate(targetRoom)}
      />
    </div>
  );
}
