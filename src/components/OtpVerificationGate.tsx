'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { ShieldCheck, Lock, Smartphone, ArrowRight, Loader2, Sparkles, Radio, MonitorOff } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { AvailableRoomsSheet } from '@/components/AvailableRoomsSheet';

import { useDeviceStore } from '@/stores/device-store';

interface OtpVerificationGateProps {
  roomId: string;
  onVerified: () => void;
  isVerified: boolean;
  roomMayBeOffline?: boolean;
}

export function OtpVerificationGate({
  roomId,
  onVerified,
  isVerified,
  roomMayBeOffline = false,
}: OtpVerificationGateProps) {
  const [otpValue, setOtpValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { deviceId, getEffectiveName } = useDeviceStore();

  // Auto-submit when user enters 6 digits
  const handleSubmit = async (code: string) => {
    if (code.length !== 6) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const deviceName = getEffectiveName();

      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code, deviceName, deviceId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Mã OTP không chính xác');
      }

      // Store auth session for current tab and shared tabs
      if (typeof window !== 'undefined') {
        const token = data.authToken || 'authorized';
        sessionStorage.setItem(`fastroom_auth_${roomId}`, token);
        localStorage.setItem(`fastroom_auth_${roomId}`, token);
      }

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success('Xác thực OTP thành công! Đã vào phòng.');
      onVerified();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Xác thực thất bại';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (val: string) => {
    setOtpValue(val);
    setErrorMsg(null);
    if (val.length === 6) {
      handleSubmit(val);
    }
  };

  if (isVerified) return null;

  return (
    <div className="h-dvh w-full flex items-center justify-center p-3 sm:p-4 bg-background overflow-hidden">
      <Card className="w-full max-w-sm sm:max-w-md p-4 sm:p-6 bg-card border-border shadow-2xl space-y-5 sm:space-y-6 text-center">
        {/* Lock Icon */}
        <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
          <Lock className="size-7 sm:size-8" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5">
            Xác thực vào phòng
            <ShieldCheck className="size-5 text-emerald-500 inline" />
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground px-1">
            Nhìn lên màn hình <strong>Desktop</strong> và nhập mã OTP 6 chữ số đang đếm ngược:
          </p>
        </div>

        {/* Offline Warning Banner */}
        {roomMayBeOffline && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2 text-left">
            <MonitorOff className="size-4 shrink-0 mt-0.5" />
            <span>
              Phòng <strong className="font-mono">#{roomId}</strong> có thể chưa mở trên Desktop. Nếu bạn có mã OTP hợp lệ, vẫn có thể thử nhập.
            </span>
          </div>
        )}

        {/* 6-Digit OTP Input */}
        <div className="flex flex-col items-center justify-center py-1 sm:py-2 space-y-3">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={handleOtpChange}
            disabled={isSubmitting}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
              <InputOTPSlot index={1} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
              <InputOTPSlot index={2} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
              <InputOTPSlot index={4} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
              <InputOTPSlot index={5} className="size-10 sm:size-12 text-base sm:text-lg font-bold" />
            </InputOTPGroup>
          </InputOTP>

          {errorMsg && (
            <p className="text-xs text-destructive font-medium animate-in fade-in">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Submit button */}
        <Button
          onClick={() => handleSubmit(otpValue)}
          disabled={otpValue.length !== 6 || isSubmitting}
          className="w-full gap-2 h-11 text-sm font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang kiểm tra OTP...
            </>
          ) : (
            <>
              Vào phòng ngay
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        {/* Helper Note & Switch room */}
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2 text-left">
            <Smartphone className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              Mã OTP đổi mới mỗi <strong>60 giây</strong> trên Desktop. Đang kết nối tới phòng <strong className="font-mono text-foreground">#{roomId}</strong>.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer inline-flex items-center gap-1.5 py-1"
          >
            <Radio className="size-3 text-emerald-500" />
            <span>Nhầm phòng? Xem danh sách phòng đang mở</span>
          </button>
        </div>
      </Card>

      <AvailableRoomsSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  );
}
