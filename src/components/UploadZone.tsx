'use client';

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UploadCloud,
  Camera,
  ClipboardPaste,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface UploadZoneProps {
  onUploadFile: (file: File, senderDevice?: string) => Promise<void>;
  onUploadDataUrl: (dataUrl: string, name?: string, senderDevice?: string) => Promise<void>;
  isUploading: boolean;
}

export function UploadZone({
  onUploadFile,
  onUploadDataUrl,
  isUploading,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Global Paste Listener (Ctrl+V anywhere on window)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside text inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            toast.info('Đang tải ảnh từ clipboard lên phòng...');
            const deviceName = /Mobi|Android|iPhone/i.test(navigator.userAgent)
              ? 'Mobile Clipboard'
              : 'Desktop Clipboard';
            await onUploadFile(file, deviceName);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onUploadFile]);

  // Handle Drag & Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          await onUploadFile(file, 'Desktop Drag & Drop');
        } else {
          toast.warning(`File "${file.name}" không phải định dạng ảnh.`);
        }
      }
    }
  };

  // Handle File Select
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await onUploadFile(file, 'Thư viện ảnh');
      }
      e.target.value = '';
    }
  };

  // Handle Camera Capture
  const handleCameraChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      await onUploadFile(file, 'Mobile Camera');
      e.target.value = '';
    }
  };

  // Handle Manual Paste Button Click
  const handlePasteButtonClick = async () => {
    if (!navigator.clipboard) {
      toast.error('Trình duyệt không hỗ trợ đọc clipboard trực tiếp. Hãy bấm phím Ctrl+V!');
      return;
    }

    try {
      if (navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        let foundImage = false;

        for (const item of clipboardItems) {
          const imageType = item.types.find((type) => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], `clipboard-${Date.now()}.png`, { type: imageType });
            await onUploadFile(file, 'Clipboard Paste');
            foundImage = true;
            break;
          }
        }

        if (!foundImage) {
          toast.info('Không tìm thấy ảnh trong Clipboard. Bạn hãy chụp màn hình rồi bấm dán lại nhé!');
        }
      } else {
        toast.info('Bạn hãy nhấn tổ hợp phím Ctrl + V để dán ảnh trực tiếp.');
      }
    } catch {
      toast.info('Bạn hãy nhấn phím Ctrl + V trên máy tính để dán ảnh trực tiếp.');
    }
  };

  return (
    <Card
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative overflow-hidden transition-all duration-200 border-2 border-dashed p-3 sm:p-6 text-center w-full max-w-full ${
        isDragging
          ? 'border-primary bg-primary/10 scale-[1.01]'
          : 'border-border/80 bg-card/60 hover:border-primary/50 hover:bg-card/90'
      }`}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-3.5 sm:space-y-4 w-full min-w-0">
        {/* Animated Icon */}
        <div className="relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            {isUploading ? (
              <Loader2 className="size-7 sm:size-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="size-7 sm:size-8" />
            )}
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 bg-emerald-500"></span>
          </span>
        </div>

        {/* Text Guidelines */}
        <div className="space-y-1 w-full px-2">
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center justify-center gap-1.5">
            <span className="hidden sm:inline">Kéo thả hoặc dán ảnh vào đây</span>
            <span className="sm:hidden">Gửi ảnh tức thì</span>
            <Sparkles className="size-4 text-amber-400 inline shrink-0" />
          </h3>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground">
            Nhấn <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-border">Ctrl</kbd> +{' '}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-border">V</kbd> để dán ảnh chụp màn hình ngay tức thì.
          </p>
          <p className="sm:hidden text-xs text-muted-foreground">
            Chụp ảnh trực tiếp hoặc chọn ảnh từ thư viện
          </p>
        </div>

        {/* Action Buttons - Desktop (File Pick + Clipboard Paste) */}
        <div className="hidden sm:flex items-center justify-center gap-2.5 w-full max-w-md mx-auto pt-1">
          <Button
            type="button"
            variant="default"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 gap-2 text-sm font-medium shadow-sm"
          >
            <ImageIcon className="size-4 shrink-0" />
            <span>Chọn ảnh từ máy</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isUploading}
            onClick={handlePasteButtonClick}
            className="h-9 gap-2 text-sm font-medium"
          >
            <ClipboardPaste className="size-4 text-amber-500 shrink-0" />
            <span>Dán ảnh (Clipboard / Ctrl+V)</span>
          </Button>
        </div>

        {/* Action Buttons - Mobile (Camera direct snap + Library file picker) */}
        <div className="sm:hidden grid grid-cols-2 gap-2 w-full max-w-xs mx-auto pt-1">
          <Button
            type="button"
            variant="default"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="h-10 gap-2 text-xs font-medium shadow-sm"
          >
            <Camera className="size-4 shrink-0" />
            <span>Chụp ảnh ngay</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 gap-2 text-xs font-medium hover:bg-muted"
          >
            <ImageIcon className="size-4 text-primary shrink-0" />
            <span>Thư viện ảnh</span>
          </Button>
        </div>

        {/* Ephemeral Notice */}
        <div className="pt-2 flex items-center justify-center w-full px-2">
          <div className="inline-flex items-center justify-center rounded-full border border-border/70 px-3 py-1 text-[11px] text-muted-foreground text-center leading-tight max-w-full">
            <span className="sm:hidden">Tự hủy 5 phút • Realtime • Không lưu server</span>
            <span className="hidden sm:inline">Tự động xóa sau 5 phút • Realtime không cần reload • Không lưu server</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
