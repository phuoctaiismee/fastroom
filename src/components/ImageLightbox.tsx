'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, Check, X } from 'lucide-react';
import { SharedFile } from '@/lib/room-store';
import { copyImageToClipboard, downloadDataUrl, formatBytes } from '@/lib/client-utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface ImageLightboxProps {
  file: SharedFile | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ file, isOpen, onOpenChange }: ImageLightboxProps) {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const handleCopy = async () => {
    const res = await copyImageToClipboard(file.dataUrl);
    if (res.success) {
      setCopied(true);
      toast.success('Đã copy ảnh vào clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadDataUrl(file.dataUrl, file.name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-4xl max-h-[85dvh] sm:max-h-[90dvh] h-[85dvh] sm:h-[88dvh] p-3 sm:p-4 flex flex-col bg-background/95 backdrop-blur-md border-border overflow-hidden"
      >
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2 max-w-[50%] sm:max-w-[65%]">
            <DialogTitle className="text-sm font-semibold truncate">
              {file.name}
            </DialogTitle>
            <Badge variant="outline" className="text-[11px] shrink-0">
              {formatBytes(file.size)}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 px-2 sm:px-3 gap-1.5 text-xs">
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Tải về</span>
            </Button>
            <Button size="sm" onClick={handleCopy} className="h-8 px-2 sm:px-3 gap-1.5 text-xs">
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Đã copy' : 'Copy ảnh'}</span>
            </Button>
            <DialogClose render={<Button variant="ghost" size="icon-sm" className="size-8 ml-1" />}>
              <X className="size-4" />
              <span className="sr-only">Đóng</span>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Full Image Container */}
        <div className="flex-1 relative w-full min-h-0 bg-neutral-950/90 rounded-lg flex items-center justify-center p-2 overflow-hidden mt-3">
          <Image
            src={file.dataUrl}
            alt={file.name}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
