'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Image as ImageIcon,
  Users,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import { AvailableRoomSummary } from '@/lib/room-store';
import { useRouter } from 'next/navigation';

interface AvailableRoomsSheetProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectRoom?: (roomId: string) => void;
}

export function AvailableRoomsSheet({
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSelectRoom,
}: AvailableRoomsSheetProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (val: boolean) => {
    if (isControlled) {
      setControlledOpen?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  // TanStack Query with automatic background polling
  const {
    data: rooms = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AvailableRoomSummary[]>({
    queryKey: ['available-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      return Array.isArray(data.rooms) ? data.rooms : [];
    },
    refetchInterval: isOpen ? 3000 : 6000,
  });

  const handleJoin = (roomId: string) => {
    setIsOpen(false);
    if (onSelectRoom) {
      onSelectRoom(roomId);
    } else {
      if (typeof window !== 'undefined') {
        window.location.href = `/room/${roomId}`;
      } else {
        router.push(`/room/${roomId}`);
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {children && <SheetTrigger render={children as React.ReactElement} />}

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-background">
        {/* Header */}
        <SheetHeader className="p-4 sm:p-5 border-b border-border/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <SheetTitle className="text-base sm:text-lg font-bold">
                Phòng đang hoạt động
              </SheetTitle>
              <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                {rooms.length} online
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled={isFetching}
              onClick={() => refetch()}
              title="Làm mới danh sách"
              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Các phòng đang mở trên máy tính hoặc có ảnh lưu tạm. Chọn phòng để tham gia tức thì.
          </SheetDescription>
        </SheetHeader>

        {/* Room List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="py-12 px-4 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="size-5 animate-spin text-primary" />
              <span>Đang tải danh sách phòng...</span>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <Inbox className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  Chưa có phòng nào đang online
                </h4>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Hiện chưa có máy tính nào mở phòng. Bạn hãy mở phòng trên máy tính trước để nhận ảnh từ điện thoại.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-xs gap-1.5 h-8 mt-2 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                Kiểm tra lại
              </Button>
            </div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.roomId}
                onClick={() => handleJoin(room.roomId)}
                className="group p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs active:scale-[0.99]"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-foreground truncate">
                      #{room.roomId}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 bg-emerald-50/50">
                      Đang mở
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="size-3 text-primary/70" />
                      {room.fileCount} ảnh
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3 text-primary/70" />
                      {room.clientsCount} kết nối
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoin(room.roomId);
                  }}
                  className="h-8 px-3 text-xs gap-1 shrink-0 font-medium cursor-pointer"
                >
                  <span>Vào</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer tip */}
        <div className="p-3 border-t border-border/60 bg-muted/20 text-center text-[11px] text-muted-foreground">
          Tự động đồng bộ bằng React Query • Tự hủy sau 5 phút
        </div>
      </SheetContent>
    </Sheet>
  );
}
