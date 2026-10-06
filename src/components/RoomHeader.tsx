'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Zap,
  QrCode,
  Trash2,
  Share2,
  Check,
  LogOut,
  Users,
  MoreVertical,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { copyTextToClipboard } from '@/lib/client-utils';
import { toast } from 'sonner';
import { OtpBadge } from '@/components/OtpBadge';
import { ConnectedPeer } from '@/stores/room-store';

interface RoomHeaderProps {
  roomId: string;
  isConnected: boolean;
  fileCount: number;
  currentOtp?: string;
  otpRemainingSeconds?: number;
  connectedPeers?: ConnectedPeer[];
  onOpenQr: () => void;
  onClearRoom: () => void;
}

export function RoomHeader({
  roomId,
  isConnected,
  fileCount,
  currentOtp,
  otpRemainingSeconds,
  connectedPeers = [],
  onOpenQr,
  onClearRoom,
}: RoomHeaderProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const formattedOtp =
    currentOtp && currentOtp.length === 6
      ? `${currentOtp.slice(0, 3)} ${currentOtp.slice(3)}`
      : currentOtp || '------';

  const handleCopyLink = async () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      const ok = await copyTextToClipboard(url);
      if (ok) {
        setCopiedLink(true);
        toast.success('Đã copy đường dẫn phòng!');
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }
  };

  const handleCopyRoomId = async () => {
    const ok = await copyTextToClipboard(roomId);
    if (ok) {
      setCopiedRoomId(true);
      toast.success(`Đã copy ID phòng: ${roomId}`);
      setTimeout(() => setCopiedRoomId(false), 2000);
    }
  };

  const handleCopyOtp = async () => {
    if (!currentOtp || currentOtp === '------') return;
    const ok = await copyTextToClipboard(currentOtp);
    if (ok) {
      setCopiedOtp(true);
      toast.success('Đã copy mã OTP!');
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl transition-all">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 w-full">
        {/* Left section: Brand Logo & Room Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link
            href="/"
            className="flex items-center gap-2 group shrink-0"
            title="Về trang chủ Fastroom"
          >
            <div className="p-1.5 sm:p-2 rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:scale-105 group-hover:rotate-3 transition-transform">
              <Zap className="size-4 sm:size-5 fill-current" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold tracking-tight text-sm sm:text-base text-foreground">
                Fastroom
              </span>
              <span className="text-[10px] text-muted-foreground hidden lg:inline whitespace-nowrap">
                Realtime Ephemeral Hub
              </span>
            </div>
          </Link>

          {/* Room ID Badge (Clickable to copy) */}
          <div className="flex items-center min-w-0 pl-2 border-l border-border/60">
            <button
              type="button"
              onClick={handleCopyRoomId}
              title="Nhấn để copy ID phòng"
              className="group flex items-center gap-1 min-w-0 rounded-lg p-0.5 hover:bg-muted/60 transition-colors cursor-pointer text-left"
            >
              <Badge
                variant="outline"
                className="font-mono text-[11px] sm:text-xs font-semibold px-2 py-0.5 bg-muted/40 hover:bg-muted/80 max-w-[100px] xs:max-w-[130px] sm:max-w-[180px] md:max-w-[240px] truncate transition-colors border-border/80"
              >
                #{roomId}
              </Badge>
              {copiedRoomId ? (
                <Check className="size-3 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline" />
              )}
            </button>
          </div>
        </div>

        {/* Right Controls Section */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* OTP Badge (Desktop & Tablet >= md) */}
          <div className="hidden md:flex items-center">
            <OtpBadge
              roomId={roomId}
              currentOtp={currentOtp}
              remainingSeconds={otpRemainingSeconds}
            />
          </div>

          {/* Connected Peers Pill (Tablet & Desktop >= sm) */}
          {connectedPeers.length > 0 && (
            <div
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium"
              title={`Thiết bị đã kết nối: ${connectedPeers.map((p) => p.deviceName).join(', ')}`}
            >
              <Users className="size-3.5 text-emerald-500" />
              <span className="font-mono text-[11px]">
                {connectedPeers.length}
                <span className="hidden md:inline"> máy</span>
              </span>
            </div>
          )}

          {/* Realtime Status Indicator */}
          <div
            className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-full bg-muted/60 border border-border/50 text-xs"
            title={isConnected ? 'Đã kết nối realtime' : 'Đang kết nối lại...'}
          >
            <span className="relative flex size-2">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full size-2 bg-amber-500 animate-pulse"></span>
              )}
            </span>
            <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground">
              {isConnected ? 'Realtime' : 'Kết nối...'}
            </span>
          </div>

          {/* Desktop & Tablet Action Buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            {/* QR Code Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenQr}
              title="Quét QR để kết nối thiết bị"
              className="h-8 px-2.5 gap-1.5 text-xs font-medium border-border/80 hover:bg-accent cursor-pointer"
            >
              <QrCode className="size-3.5 text-primary" />
              <span className="hidden lg:inline">Quét QR</span>
            </Button>

            {/* Copy Link Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyLink}
              title="Copy đường dẫn phòng"
              className="h-8 px-2.5 gap-1 text-xs font-medium cursor-pointer"
            >
              {copiedLink ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Share2 className="size-3.5" />
              )}
              <span className="hidden lg:inline">{copiedLink ? 'Đã copy' : 'Copy'}</span>
            </Button>

            {/* Clear Room Button */}
            {fileCount > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onClearRoom}
                title={`Xóa tất cả ${fileCount} ảnh`}
                className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden md:inline">Dọn ({fileCount})</span>
              </Button>
            )}

            {/* Leave Room Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              title="Rời phòng"
              className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span className="hidden lg:inline">Rời phòng</span>
            </Button>
          </div>

          {/* Mobile Action Buttons (< sm screen) */}
          <div className="flex sm:hidden items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenQr}
              title="Quét QR"
              className="h-8 w-8 p-0 border-border/80 cursor-pointer"
            >
              <QrCode className="size-3.5 text-primary" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyLink}
              title="Copy link"
              className="h-8 w-8 p-0 cursor-pointer"
            >
              {copiedLink ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Share2 className="size-3.5" />
              )}
            </Button>

            {/* Mobile Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer border border-transparent hover:border-border/60 transition-colors"
                title="Tùy chọn khác"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 space-y-1">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                  Phòng #{roomId}
                </DropdownMenuLabel>

                {/* Mobile OTP Copy option */}
                {currentOtp && (
                  <DropdownMenuItem
                    onClick={handleCopyOtp}
                    className="cursor-pointer text-xs flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="font-medium">OTP: {formattedOtp}</span>
                        <span className="text-[10px] text-muted-foreground">
                          Hết hạn sau {otpRemainingSeconds ?? 60}s
                        </span>
                      </div>
                    </div>
                    {copiedOtp ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </DropdownMenuItem>
                )}

                {/* Mobile Connected Peers summary */}
                {connectedPeers.length > 0 && (
                  <DropdownMenuItem disabled className="text-xs flex items-center gap-2 py-1.5 opacity-100">
                    <Users className="size-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {connectedPeers.length} thiết bị đang kết nối
                    </span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={onOpenQr}
                  className="cursor-pointer text-xs flex items-center gap-2 py-2"
                >
                  <QrCode className="size-4 text-primary" />
                  <span>Mở mã QR phòng</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="cursor-pointer text-xs flex items-center gap-2 py-2"
                >
                  <Share2 className="size-4 text-muted-foreground" />
                  <span>Copy link phòng</span>
                </DropdownMenuItem>

                {fileCount > 0 && (
                  <DropdownMenuItem
                    onClick={onClearRoom}
                    variant="destructive"
                    className="cursor-pointer text-xs flex items-center gap-2 py-2 text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                    <span>Dọn sạch phòng ({fileCount} ảnh)</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/';
                  }}
                  className="cursor-pointer text-xs flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  <span>Rời khỏi phòng</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
