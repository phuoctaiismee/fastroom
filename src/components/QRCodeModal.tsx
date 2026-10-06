'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, QrCode, Smartphone, Wifi, Globe } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/client-utils';
import { toast } from 'sonner';

interface QRCodeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  currentOtp?: string;
}

export function QRCodeModal({ isOpen, onOpenChange, roomId, currentOtp }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch LAN IPs from server only when modal is opened
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.ipAddresses && data.ipAddresses.length > 0) {
          setLanIps(data.ipAddresses);
          // If current host is localhost or 127.0.0.1, default to primary LAN IP
          const currentHostname = window.location.hostname;
          const port = window.location.port ? `:${window.location.port}` : '';
          const protocol = window.location.protocol;

          if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
            setSelectedHost(`${protocol}//${data.primaryIp}${port}`);
          } else {
            setSelectedHost(`${protocol}//${window.location.host}`);
          }
        } else {
          setSelectedHost(window.location.origin);
        }
      })
      .catch(() => {
        setSelectedHost(window.location.origin);
      });
  }, [isOpen]);

  const roomUrl = `${selectedHost || (typeof window !== 'undefined' ? window.location.origin : '')}/room/${roomId}`;

  const handleCopy = async () => {
    const success = await copyTextToClipboard(roomUrl);
    if (success) {
      setCopied(true);
      toast.success('Đã copy đường dẫn phòng!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Quét mã QR để vào phòng</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Mở camera điện thoại quét mã để gửi ảnh chụp bug tức thì
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-xl border border-border/60">
          <div className="p-3 bg-white rounded-xl shadow-lg border border-neutral-200">
            <QRCodeSVG
              value={roomUrl}
              size={210}
              level="M"
              includeMargin={false}
            />
          </div>

          {currentOtp && (
            <div className="mt-3 p-2.5 rounded-lg bg-background border border-border flex items-center justify-between w-full max-w-[240px]">
              <span className="text-[11px] text-muted-foreground font-medium">Mã OTP xác thực:</span>
              <span className="font-mono font-bold text-sm tracking-widest text-emerald-500">
                {currentOtp.length === 6 ? `${currentOtp.slice(0, 3)} ${currentOtp.slice(3)}` : currentOtp}
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="size-4 text-primary" />
            <span>Mở camera quét mã và nhập OTP 60s để vào phòng</span>
          </div>
        </div>

        {/* IP Switcher if multiple LAN IPs detected */}
        {lanIps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">
                <Wifi className="size-3.5 text-emerald-500" /> Chọn địa chỉ IP kết nối:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lanIps.map((ip) => {
                const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
                const target = `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${ip}${port}`;
                const isSelected = selectedHost === target;
                return (
                  <Badge
                    key={ip}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer transition-all hover:border-primary/80 text-xs py-1 px-2.5"
                    onClick={() => setSelectedHost(target)}
                  >
                    {ip}
                  </Badge>
                );
              })}
              {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
                <Badge
                  variant={selectedHost === window.location.origin ? 'default' : 'outline'}
                  className="cursor-pointer transition-all text-xs py-1 px-2.5"
                  onClick={() => setSelectedHost(window.location.origin)}
                >
                  <Globe className="size-3 mr-1 inline" /> Domain hiện tại
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Room URL Display and Copy */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
          <input
            type="text"
            readOnly
            value={roomUrl}
            className="flex-1 bg-transparent text-xs text-foreground font-mono truncate focus:outline-none px-1"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopy}
            className="h-7 text-xs gap-1.5 shrink-0"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? 'Đã copy' : 'Copy link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
