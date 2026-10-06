'use client';

import { useState } from 'react';
import { ShieldCheck, Copy, Check, RotateCw } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/client-utils';
import { toast } from 'sonner';

interface OtpBadgeProps {
  roomId: string;
  currentOtp?: string;
  remainingSeconds?: number;
}

/**
 * Pure display component.
 * OTP value comes from the Zustand store (1 initial fetch by the host + SSE `otp_rotated` pushes),
 * countdown is derived from the store's 1s ticker — this component makes NO network requests.
 */
export function OtpBadge({ currentOtp, remainingSeconds }: OtpBadgeProps) {
  const [copied, setCopied] = useState(false);
  const otp = currentOtp || '------';
  const remaining = typeof remainingSeconds === 'number' ? remainingSeconds : 60;

  const handleCopy = async () => {
    if (otp === '------') return;
    const ok = await copyTextToClipboard(otp);
    if (ok) {
      setCopied(true);
      toast.success('Đã copy mã OTP!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Split OTP into 3-3 (e.g. 123 456)
  const formattedOtp = otp.length === 6 ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-sm">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="size-4 text-emerald-500" />
        <span className="text-xs text-muted-foreground font-medium hidden sm:inline">OTP xác thực:</span>
      </div>

      <div
        onClick={handleCopy}
        title="Bấm để copy OTP"
        className="cursor-pointer group flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-muted/80 hover:bg-muted font-mono font-bold text-sm sm:text-base text-foreground tracking-wider transition-colors border border-border/60"
      >
        <span>{formattedOtp}</span>
        {copied ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Copy className="size-3 text-muted-foreground group-hover:text-foreground opacity-60 group-hover:opacity-100" />
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground" title="Mã tự động đổi sau 60s">
        <RotateCw className={`size-3 text-amber-500 ${remaining <= 5 ? 'animate-spin' : ''}`} />
        <span className={remaining <= 10 ? 'text-destructive font-bold' : ''}>{remaining}s</span>
      </div>
    </div>
  );
}
