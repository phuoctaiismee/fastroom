'use client';

import { useState } from 'react';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Download,
  Trash2,
  Maximize2,
  Clock,
  Pin,
  PinOff,
  Check,
  Code,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { SharedFile, FILE_TTL_MS } from '@/lib/room-store';
import {
  copyImageToClipboard,
  copyTextToClipboard,
  downloadDataUrl,
  formatBytes,
  formatTimeRemaining,
} from '@/lib/client-utils';
import { toast } from 'sonner';

interface FileCardProps {
  file: SharedFile;
  now: number;
  isPaused: boolean;
  onDelete: (fileId: string) => void;
  onTogglePause: (fileId: string) => void;
  onOpenLightbox: (file: SharedFile) => void;
}

export function FileCard({
  file,
  now,
  isPaused,
  onDelete,
  onTogglePause,
  onOpenLightbox,
}: FileCardProps) {
  const [copyingImage, setCopyingImage] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [base64Copied, setBase64Copied] = useState(false);

  // Remaining time calculation
  const remainingMs = Math.max(0, file.expiresAt - now);
  // Tiến trình tự hủy: chạy thuận từ 0% (vừa tải lên) -> 100% (hết hạn 5 phút)
  const elapsedMs = Math.max(0, Math.min(FILE_TTL_MS, FILE_TTL_MS - remainingMs));
  const progressPercent = Math.min(
    100,
    Math.max(0, (elapsedMs / FILE_TTL_MS) * 100)
  );

  // Color indicator for time remaining
  const isExpiringSoon = remainingMs < 60 * 1000; // Less than 1 minute

  // Copy Image Bitmap to Clipboard (For AI Agents / Slack / Jira)
  const handleCopyImage = async () => {
    setCopyingImage(true);
    try {
      const result = await copyImageToClipboard(file.dataUrl);
      if (result.success) {
        setImageCopied(true);
        // Small celebratory confetti burst
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.8 },
        });

        if (result.type === 'image') {
          toast.success('Đã copy ảnh vào Clipboard hệ thống!', {
            description: 'Ảnh đã có trong Clipboard Windows (Win+V). Nhấn Ctrl+V để dán trực tiếp.',
          });
        } else if (result.type === 'insecure') {
          toast.warning('Cảnh báo bảo mật trình duyệt:', {
            description: result.error || 'Vui lòng truy cập http://localhost:3000 trên máy tính để trình duyệt cho phép copy ảnh.',
            duration: 6000,
          });
        } else {
          toast.info('Đã copy chuỗi Base64 vào clipboard.', {
            description: result.error ? `Chi tiết: ${result.error}` : undefined,
          });
        }

        setTimeout(() => setImageCopied(false), 2500);
      } else {
        if (result.type === 'insecure') {
          toast.warning('Cần mở localhost trên PC:', {
            description: result.error || 'Mở http://localhost:3000 để trình duyệt cho phép ghi ảnh vào Clipboard.',
            duration: 6000,
          });
        } else {
          toast.error(result.error || 'Không thể copy ảnh vào clipboard.');
        }
      }
    } finally {
      setCopyingImage(false);
    }
  };

  // Copy Base64 text
  const handleCopyBase64 = async () => {
    const success = await copyTextToClipboard(file.dataUrl);
    if (success) {
      setBase64Copied(true);
      toast.success('Đã copy chuỗi Base64 Data URL!');
      setTimeout(() => setBase64Copied(false), 2000);
    } else {
      toast.error('Không thể copy văn bản.');
    }
  };

  // Download Image
  const handleDownload = () => {
    downloadDataUrl(file.dataUrl, file.name);
    toast.success(`Đã tải về: ${file.name}`);
  };

  // Determine device icon
  const isMobile = file.senderDevice?.toLowerCase().includes('mobile') ||
    file.senderDevice?.toLowerCase().includes('camera');

  return (
    <Card className="group relative flex flex-col overflow-hidden border-border bg-card transition-all duration-200 hover:shadow-lg hover:border-primary/40">
      {/* Top Countdown Bar */}
      <div className="w-full bg-muted/60 px-3 py-1.5 flex items-center justify-between text-xs border-b border-border/50">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className={`size-3.5 ${isExpiringSoon ? 'text-destructive animate-pulse' : 'text-amber-500'}`} />
          {isPaused ? (
            <span className="text-emerald-500 font-semibold">Đã ghim (Vô hạn)</span>
          ) : (
            <span className={isExpiringSoon ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
              Tự hủy sau: <strong className="font-mono">{formatTimeRemaining(remainingMs)}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Pin / Pause Countdown */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onTogglePause(file.id)}
            title={isPaused ? 'Bỏ ghim (tiếp tục đếm ngược 5p)' : 'Ghim ảnh (tạm dừng đếm ngược)'}
            className={`size-6 rounded ${isPaused ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {isPaused ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
          </Button>

          {/* Delete early */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(file.id)}
            title="Xóa ảnh ngay"
            className="size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Image Preview Container */}
      <div
        onClick={() => onOpenLightbox(file)}
        className="relative w-full h-48 sm:h-56 bg-neutral-950 flex items-center justify-center overflow-hidden cursor-zoom-in group/img"
      >
        <Image
          src={file.dataUrl}
          alt={file.name}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain transition-transform duration-300 group-hover/img:scale-105"
        />

        {/* Hover zoom overlay badge */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
          <Badge variant="secondary" className="gap-1.5 shadow-lg backdrop-blur-sm bg-background/80">
            <Maximize2 className="size-3.5" /> Phóng to ảnh
          </Badge>
        </div>

        {/* Device source badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="text-[10px] py-0 px-2 bg-neutral-900/80 text-neutral-200 border-neutral-700/60 backdrop-blur-sm gap-1"
          >
            {isMobile ? <Smartphone className="size-3 text-emerald-400" /> : <Laptop className="size-3 text-sky-400" />}
            {file.senderDevice || 'Thiết bị'}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 bg-neutral-900/80 text-neutral-300 border-neutral-700/60 backdrop-blur-sm"
          >
            {formatBytes(file.size)}
          </Badge>
        </div>
      </div>

      {/* Progress Line below image with padding */}
      {!isPaused && (
        <div className="px-3 pt-2.5 sm:px-3.5" title={`Tiến trình tự hủy: ${Math.round(progressPercent)}%`}>
          <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isExpiringSoon ? 'bg-destructive' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* File Info & Action Buttons */}
      <div className="p-3 sm:p-3.5 flex flex-col gap-2.5 sm:gap-3 flex-1 justify-between bg-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-medium text-foreground truncate" title={file.name}>
              {file.name}
            </h4>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
              Đẩy lên lúc: {new Date(file.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Hero Action: Copy Image Bitmap */}
          <Button
            variant={imageCopied ? 'secondary' : 'default'}
            size="sm"
            disabled={copyingImage}
            onClick={handleCopyImage}
            className={`w-full h-10 sm:h-9 gap-2 font-medium text-xs sm:text-sm transition-all ${
              imageCopied
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {imageCopied ? (
              <Check className="size-4 text-white" />
            ) : (
              <Copy className="size-4" />
            )}
            {imageCopied ? 'Đã copy! Dán (Ctrl+V) ngay' : 'Copy ảnh vào Agent'}
          </Button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5 text-xs h-9 sm:h-8 hover:bg-muted"
            >
              <Download className="size-3.5" />
              Tải về
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyBase64}
              className="gap-1.5 text-xs h-9 sm:h-8 hover:bg-muted"
            >
              {base64Copied ? <Check className="size-3.5 text-emerald-500" /> : <Code className="size-3.5" />}
              {base64Copied ? 'Đã copy' : 'Base64'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
