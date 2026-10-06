'use client';

import { useEffect, useCallback, useRef } from 'react';
import { RoomEvent, SharedFile } from '@/lib/room-store';
import { useFastroomStore } from '@/stores/room-store';
import { useDeviceStore } from '@/stores/device-store';
import { playNotificationSound, compressImageFile } from '@/lib/client-utils';
import { toast } from 'sonner';

interface UseFastroomOptions {
  roomId: string;
  enabled?: boolean;
  isHost?: boolean;
}

export function useFastroom({ roomId, enabled = true, isHost = false }: UseFastroomOptions) {
  // Use individual fine-grained selectors to avoid re-rendering loops
  const files = useFastroomStore((s) => s.files);
  const isLoadingFiles = useFastroomStore((s) => s.isLoadingFiles);
  const isConnected = useFastroomStore((s) => s.isConnected);
  const isUploading = useFastroomStore((s) => s.isUploading);
  const now = useFastroomStore((s) => s.now);
  const currentOtp = useFastroomStore((s) => s.currentOtp);
  const otpRemainingSeconds = useFastroomStore((s) => s.otpRemainingSeconds);
  const connectedPeers = useFastroomStore((s) => s.connectedPeers);

  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Synchronize roomId only when roomId changes
  useEffect(() => {
    if (roomId) {
      useFastroomStore.getState().setRoomId(roomId);
    }
  }, [roomId]);

  // 2. Initial fetch of active files (+ OTP for the host only), in parallel.
  //    After this, OTP updates arrive exclusively via the SSE `otp_rotated` event — no polling.
  const fetchRoomData = useCallback(async () => {
    if (!roomId || !enabled) return;
    const base = `/api/room/${encodeURIComponent(roomId)}`;

    const filesTask = (async () => {
      try {
        const res = await fetch(`${base}/files`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.files)) {
            useFastroomStore.getState().setFiles(data.files);
          }
        }
      } catch (err) {
        console.error('Failed to load initial room files:', err);
      } finally {
        useFastroomStore.getState().setIsLoadingFiles(false);
      }
    })();

    const otpTask = isHost
      ? (async () => {
          try {
            const res = await fetch(`${base}/otp?role=host`, { cache: 'no-store' });
            if (res.ok) {
              const otpData = await res.json();
              useFastroomStore.getState().setOtp(otpData.otp, otpData.remainingSeconds);
            }
          } catch (err) {
            console.error('Failed to load initial room OTP:', err);
          }
        })()
      : Promise.resolve();

    await Promise.all([filesTask, otpTask]);
  }, [roomId, enabled, isHost]);

  // Trigger room data fetch independently
  useEffect(() => {
    if (roomId && enabled) {
      fetchRoomData();
    }
  }, [roomId, enabled, fetchRoomData]);

  // 3. Setup Server-Sent Events (SSE) for Realtime + Auto-fetch on connect
  useEffect(() => {
    if (!roomId || !enabled) return;

    const url = `/api/room/${encodeURIComponent(roomId)}/events${isHost ? '?role=host' : ''}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      useFastroomStore.getState().setIsConnected(true);
      fetchRoomData();
    };

    eventSource.onerror = () => {
      useFastroomStore.getState().setIsConnected(false);
    };

    eventSource.onmessage = (e) => {
      try {
        const event: RoomEvent | { type: 'connected'; roomId: string } = JSON.parse(e.data);
        const store = useFastroomStore.getState();

        if (event.type === 'connected') {
          store.setIsConnected(true);
          fetchRoomData();
        } else if (event.type === 'file_added') {
          store.addFile(event.file);
          playNotificationSound();
          toast.success(`Ảnh mới: ${event.file.name}`, {
            description: `${event.file.senderDevice ? `Từ ${event.file.senderDevice} • ` : ''}Tự động xóa sau 5 phút.`,
          });
        } else if (event.type === 'file_updated') {
          store.updateFile(event.file);
        } else if (event.type === 'file_removed') {
          store.removeFile(event.fileId);
        } else if (event.type === 'room_cleared') {
          store.clearFiles();
          toast.info('Phòng đã được dọn sạch toàn bộ ảnh.');
        } else if (event.type === 'otp_rotated') {
          store.setOtp(event.otp, 60);
        } else if (event.type === 'peer_joined') {
          store.addPeer({
            deviceName: event.deviceName,
            deviceId: event.deviceId,
            timestamp: event.timestamp,
          });
          playNotificationSound();
          toast.success(`Thiết bị đã kết nối!`, {
            description: `${event.deviceName} đã tham gia phòng.`,
          });
        }
      } catch (err) {
        console.error('Error handling SSE event:', err);
      }
    };

    const handleUnload = () => {
      try {
        eventSource.close();
      } catch {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('pagehide', handleUnload);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('pagehide', handleUnload);
      }
      try {
        eventSource.close();
      } catch {}
      eventSourceRef.current = null;
    };
  }, [roomId, enabled, isHost, fetchRoomData]);

  // 4. Timer ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      useFastroomStore.getState().tickNow();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 5. Auto refresh OTP on Desktop when countdown expires (otpRemainingSeconds <= 1)
  useEffect(() => {
    if (isHost && roomId && enabled && otpRemainingSeconds <= 1) {
      const base = `/api/room/${encodeURIComponent(roomId)}`;
      fetch(`${base}/otp?role=host`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((otpData) => {
          if (otpData.otp) {
            useFastroomStore.getState().setOtp(otpData.otp, otpData.remainingSeconds);
          }
        })
        .catch(() => {});
    }
  }, [isHost, roomId, enabled, otpRemainingSeconds]);

  // 5. Active synchronization polling (every 3s) — ADDITIVE ONLY
  //    On Vercel Serverless each request may hit a different container.
  //    We NEVER remove client files based on polling (that would cause files
  //    to vanish when a cold container returns an empty list).
  //    Removals only come from SSE events (file_removed / room_cleared) or user actions.
  const selfDeviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    selfDeviceIdRef.current = useDeviceStore.getState().deviceId;
  }, []);

  useEffect(() => {
    if (!roomId || !enabled) return;

    const syncInterval = setInterval(async () => {
      try {
        const base = `/api/room/${encodeURIComponent(roomId)}`;
        const res = await fetch(`${base}/files`, {
          cache: 'no-store',
          headers: { 'x-client-ts': String(Date.now()) },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!Array.isArray(data.files)) return;

        const store = useFastroomStore.getState();
        const currentFiles = store.files;
        const clientIds = new Set(currentFiles.map((f) => f.id));

        for (const serverFile of data.files as SharedFile[]) {
          if (!clientIds.has(serverFile.id)) {
            // New file the client doesn't know about yet
            const isSelf = serverFile.senderDeviceId && serverFile.senderDeviceId === selfDeviceIdRef.current;
            if (!isSelf) {
              playNotificationSound();
              toast.success(`Ảnh mới: ${serverFile.name}`, {
                description: `${serverFile.senderDevice ? `Từ ${serverFile.senderDevice} • ` : ''}Tự động xóa sau 5 phút.`,
              });
            }
          }
        }

        // Sync exact server active files (handles deletions & room clears)
        store.setFiles(data.files);
      } catch {
        // Silent background catch
      }
    }, 2500);

    return () => {
      clearInterval(syncInterval);
    };
  }, [roomId, enabled]);

  // 5. File upload via Base64 with client-side compression
  const uploadFile = useCallback(
    async (file: File, customSenderDevice?: string) => {
      if (!roomId) return;
      useFastroomStore.getState().setIsUploading(true);

      const deviceState = useDeviceStore.getState();
      const senderDevice = customSenderDevice || deviceState.getEffectiveName();

      try {
        // Compress image before sending base64 over the wire
        const { dataUrl, size, name, type } = await compressImageFile(file);

        const payload = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          type,
          size,
          dataUrl,
          senderDevice,
          senderName: senderDevice,
          senderDeviceId: deviceState.deviceId,
        };

        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        if (data.file) {
          useFastroomStore.getState().addFile(data.file);
        }

        toast.success('Đã tải ảnh lên phòng thành công!');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Tải lên thất bại';
        toast.error(`Lỗi tải lên: ${message}`);
        console.error('Upload error:', err);
      } finally {
        useFastroomStore.getState().setIsUploading(false);
      }
    },
    [roomId]
  );

  // 6. Upload from DataURL (for Clipboard Paste)
  const uploadDataUrl = useCallback(
    async (dataUrl: string, name = 'screenshot.png', customSenderDevice?: string) => {
      if (!roomId) return;
      useFastroomStore.getState().setIsUploading(true);

      const deviceState = useDeviceStore.getState();
      const senderDevice = customSenderDevice || deviceState.getEffectiveName();

      try {
        // Approximate size
        const size = Math.round((dataUrl.length * 3) / 4);

        const payload = {
          id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          type: dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
          size,
          dataUrl,
          senderDevice,
          senderName: senderDevice,
          senderDeviceId: deviceState.deviceId,
        };

        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        toast.success('Đã dán ảnh thành công!');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Tải lên thất bại';
        toast.error(`Lỗi dán ảnh: ${message}`);
        console.error('Upload error:', err);
      } finally {
        useFastroomStore.getState().setIsUploading(false);
      }
    },
    [roomId]
  );

  // 7. Delete File
  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!roomId) return;
      try {
        const res = await fetch(
          `/api/room/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}`,
          { method: 'DELETE' }
        );
        if (res.ok) {
          useFastroomStore.getState().removeFile(fileId);
          toast.success('Đã xóa ảnh');
        }
      } catch (err) {
        console.error('Delete error:', err);
        toast.error('Lỗi khi xóa ảnh');
      }
    },
    [roomId]
  );

  // 8. Clear Room
  const clearRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/clear`, {
        method: 'POST',
      });
      if (res.ok) {
        useFastroomStore.getState().clearFiles();
        toast.success('Đã dọn sạch phòng');
      }
    } catch (err) {
      console.error('Clear error:', err);
      toast.error('Lỗi dọn dẹp phòng');
    }
  }, [roomId]);

  // 9. Pin / Unpin (server-side, synced to all devices via SSE `file_updated`)
  const togglePause = useCallback(
    async (fileId: string) => {
      if (!roomId) return;
      const store = useFastroomStore.getState();
      const current = store.files.find((f) => f.id === fileId);
      if (!current) return;

      const nextPinned = !current.isPinned;
      // Optimistic update so the UI reacts instantly
      store.updateFile({ ...current, isPinned: nextPinned });

      try {
        const res = await fetch(
          `/api/room/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: nextPinned }),
          }
        );
        if (!res.ok) throw new Error((await res.json()).error || 'Pin failed');
        const data = await res.json();
        // Server is the source of truth (e.g. new expiresAt after unpin)
        useFastroomStore.getState().updateFile(data.file);
        toast.success(nextPinned ? 'Đã ghim ảnh trên mọi thiết bị' : 'Đã bỏ ghim — đếm ngược lại 5 phút');
      } catch (err) {
        // Rollback
        useFastroomStore.getState().updateFile(current);
        const message = err instanceof Error ? err.message : 'Không thể ghim ảnh';
        toast.error(message);
      }
    },
    [roomId]
  );

  return {
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
  };
}
