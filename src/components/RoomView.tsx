'use client';

import { useState, useEffect } from 'react';
import { useFastroom } from '@/hooks/use-fastroom';
import { SharedFile } from '@/lib/room-store';
import { RoomHeader } from '@/components/RoomHeader';
import { UploadZone } from '@/components/UploadZone';
import { FileCard } from '@/components/FileCard';
import { QRCodeModal } from '@/components/QRCodeModal';
import { ImageLightbox } from '@/components/ImageLightbox';
import { Badge } from '@/components/ui/badge';
import { Clock, Image as ImageIcon, Loader2 } from 'lucide-react';

import { OtpVerificationGate } from '@/components/OtpVerificationGate';
import { useDeviceStore } from '@/stores/device-store';

interface RoomViewProps {
  roomId: string;
}

export function RoomView({ roomId }: RoomViewProps) {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<SharedFile | null>(null);

  const deviceId = useDeviceStore((s) => s.deviceId);

  const [isHost, setIsHost] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [isRoomAvailable, setIsRoomAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!roomId || !deviceId) return;

    let hasCreateIntent = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        hasCreateIntent = sessionStorage.getItem(`fastroom_create_intent_${roomId}`) === 'true';
        if (hasCreateIntent) {
          sessionStorage.removeItem(`fastroom_create_intent_${roomId}`);
        }
      }
    } catch {}

    const statusUrl = `/api/room/${encodeURIComponent(roomId)}/status?deviceId=${encodeURIComponent(deviceId)}${hasCreateIntent ? '&claimHost=true' : ''}`;

    fetch(statusUrl)
      .then((res) => res.json())
      .then((data) => {
        setIsRoomAvailable(!!data.isAvailable);
        if (data.isHost) {
          setIsHost(true);
          setIsVerified(true);
          setCheckingAuth(false);
        } else {
          setIsHost(false);
          const storedAuth = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`fastroom_auth_${roomId}`) : null;
          if (storedAuth) {
            setIsVerified(true);
          } else {
            setIsVerified(false);
          }
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        setIsHost(false);
        setIsRoomAvailable(false);
        const storedAuth = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`fastroom_auth_${roomId}`) : null;
        setIsVerified(!!storedAuth);
        setCheckingAuth(false);
      });
  }, [roomId, deviceId]);

  const {
    files,
    isLoadingFiles,
    isConnected,
    isUploading,
    now,
    currentOtp,
    otpRemainingSeconds,
    connectedPeers,
    uploadFile,
    uploadDataUrl,
    deleteFile,
    clearRoom,
    togglePause,
  } = useFastroom({
    roomId,
    enabled: isVerified && !checkingAuth,
    isHost,
  });

  if (checkingAuth) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isVerified) {
    return (
      <OtpVerificationGate
        roomId={roomId}
        isVerified={isVerified}
        onVerified={() => setIsVerified(true)}
        roomMayBeOffline={isRoomAvailable === false}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground w-full max-w-full overflow-x-hidden">
      {/* Top Header */}
      <RoomHeader
        roomId={roomId}
        isConnected={isConnected}
        fileCount={files.length}
        currentOtp={currentOtp}
        otpRemainingSeconds={otpRemainingSeconds}
        connectedPeers={connectedPeers}
        isHost={isHost}
        onOpenQr={() => setIsQrOpen(true)}
        onClearRoom={clearRoom}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Upload & Paste Zone */}
        <UploadZone
          onUploadFile={uploadFile}
          onUploadDataUrl={uploadDataUrl}
          isUploading={isUploading}
        />

        {/* Realtime Files Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                Kho ảnh tạm thời
                <Badge variant="secondary" className="font-mono text-xs">
                  {files.length} ảnh
                </Badge>
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-amber-500" />
              <span className="hidden sm:inline">Mỗi ảnh tự hủy sau 5 phút</span>
            </div>
          </div>

          {isLoadingFiles && files.length === 0 ? (
            /* Shimmer Skeleton Grid when loading files */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/70 bg-card/70 p-4 space-y-3 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-muted rounded w-28" />
                    <div className="h-4 bg-muted rounded w-12" />
                  </div>
                  <div className="h-48 sm:h-56 bg-muted/60 rounded-lg flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 text-muted-foreground/50 animate-spin" />
                    <span className="text-xs text-muted-foreground/60 font-mono">Đang nạp ảnh...</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted/70 rounded w-1/2" />
                  </div>
                  <div className="h-9 bg-muted/60 rounded" />
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            /* Empty State */
            <div className="py-10 px-4 text-center rounded-2xl border-2 border-dashed border-neutral-200/80 bg-white/60 flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400">
                <ImageIcon className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800">
                Chưa có ảnh nào trong phòng
              </h3>
              <p className="text-xs text-neutral-400 max-w-xs">
                Chụp màn hình trên điện thoại hoặc nhấn <kbd className="px-1 py-0.5 font-mono text-[11px] bg-neutral-100 rounded border border-neutral-200">Ctrl+V</kbd> để dán ảnh lên tức thì.
              </p>
            </div>
          ) : (
            /* Responsive Grid of Realtime Files */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  now={now}
                  isPaused={!!file.isPinned}
                  onDelete={deleteFile}
                  onTogglePause={togglePause}
                  onOpenLightbox={setLightboxFile}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-3 mt-auto text-[11px] text-muted-foreground font-mono">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs">
          <span>Fastroom • Tự hủy sau 5 phút</span>
          <span className="text-[11px] text-muted-foreground/80">Realtime in-memory</span>
        </div>
      </footer>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQrOpen}
        onOpenChange={setIsQrOpen}
        roomId={roomId}
        currentOtp={currentOtp}
      />

      {/* Full Resolution Image Lightbox */}
      <ImageLightbox
        file={lightboxFile}
        isOpen={!!lightboxFile}
        onOpenChange={(open) => !open && setLightboxFile(null)}
      />
    </div>
  );
}
