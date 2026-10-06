'use client';

import { create } from 'zustand';
import { SharedFile } from '@/lib/room-store';

export interface ConnectedPeer {
  deviceName: string;
  deviceId?: string;
  timestamp: number;
}

interface FastroomState {
  roomId: string | null;
  files: SharedFile[];
  isLoadingFiles: boolean;
  isConnected: boolean;
  isUploading: boolean;
  now: number;
  currentOtp: string;
  otpExpiresAt: number; // client-clock timestamp
  otpRemainingSeconds: number; // derived every tick from otpExpiresAt
  connectedPeers: ConnectedPeer[];

  // Actions
  setRoomId: (roomId: string) => void;
  setFiles: (files: SharedFile[]) => void;
  setIsLoadingFiles: (loading: boolean) => void;
  addFile: (file: SharedFile) => void;
  updateFile: (file: SharedFile) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  setIsConnected: (connected: boolean) => void;
  setIsUploading: (uploading: boolean) => void;
  setOtp: (otp: string, remainingSeconds: number) => void;
  addPeer: (peer: ConnectedPeer) => void;
  tickNow: () => void;
}

// Persist the file list per room in localStorage/sessionStorage for instant (0ms) reloads
function persistFiles(roomId: string | null, files: SharedFile[]) {
  if (!roomId || typeof window === 'undefined') return;
  try {
    const key = `fastroom_files_${roomId}`;
    if (files.length === 0) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } else {
      const dataStr = JSON.stringify(files);
      try {
        localStorage.setItem(key, dataStr);
      } catch {}
      try {
        sessionStorage.setItem(key, dataStr);
      } catch {}
    }
  } catch {
    // Quota exceeded (large base64 images) -> just skip caching
  }
}

// 10-second grace to tolerate clock skew between server and client
const EXPIRY_GRACE_MS = 10_000;

function isAlive(file: SharedFile, now: number) {
  return file.isPinned || file.expiresAt + EXPIRY_GRACE_MS > now;
}

export const useFastroomStore = create<FastroomState>((set, get) => ({
  roomId: null,
  files: [],
  isLoadingFiles: true,
  isConnected: false,
  isUploading: false,
  now: Date.now(),
  currentOtp: '------',
  otpExpiresAt: 0,
  otpRemainingSeconds: 60,
  connectedPeers: [],

  setRoomId: (roomId: string) => {
    if (get().roomId === roomId) return;

    // Try restoring cached files immediately for 0ms reload
    let cachedFiles: SharedFile[] = [];
    if (typeof window !== 'undefined') {
      try {
        const key = `fastroom_files_${roomId}`;
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const now = Date.now();
            cachedFiles = (parsed as SharedFile[]).filter((f) => isAlive(f, now));
          }
        }
      } catch {}
    }

    set({
      roomId,
      files: cachedFiles,
      isLoadingFiles: cachedFiles.length === 0,
    });
  },

  setIsLoadingFiles: (isLoadingFiles: boolean) => set({ isLoadingFiles }),

  setFiles: (incomingFiles: SharedFile[]) => {
    const currentFiles = get().files;
    const now = Date.now();

    // Map existing files
    const fileMap = new Map<string, SharedFile>();
    for (const f of currentFiles) {
      if (isAlive(f, now)) {
        fileMap.set(f.id, f);
      }
    }

    // Merge incoming files from server
    for (const f of incomingFiles) {
      if (isAlive(f, now)) {
        fileMap.set(f.id, f);
      }
    }

    const merged = Array.from(fileMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    persistFiles(get().roomId, merged);
    set({ files: merged, isLoadingFiles: false });
  },

  addFile: (file: SharedFile) => {
    const { files, roomId } = get();
    if (files.some((f) => f.id === file.id)) return;
    const next = [file, ...files];
    persistFiles(roomId, next);
    set({ files: next });
  },

  updateFile: (file: SharedFile) => {
    const { files, roomId } = get();
    const next = files.map((f) => (f.id === file.id ? file : f));
    persistFiles(roomId, next);
    set({ files: next });
  },

  removeFile: (fileId: string) => {
    const { files, roomId } = get();
    const next = files.filter((f) => f.id !== fileId);
    if (next.length === files.length) return;
    persistFiles(roomId, next);
    set({ files: next });
  },

  clearFiles: () => {
    persistFiles(get().roomId, []);
    set({ files: [], isLoadingFiles: false });
  },

  setIsConnected: (connected: boolean) => {
    if (get().isConnected !== connected) set({ isConnected: connected });
  },

  setIsUploading: (uploading: boolean) => set({ isUploading: uploading }),

  setOtp: (otp: string, remainingSeconds: number) =>
    set({
      currentOtp: otp,
      otpExpiresAt: Date.now() + remainingSeconds * 1000,
      otpRemainingSeconds: remainingSeconds,
    }),

  addPeer: (peer: ConnectedPeer) => {
    set((state) => {
      // Keep last 10 unique peers
      const filtered = state.connectedPeers.filter(
        (p) => p.deviceId !== peer.deviceId || p.deviceName !== peer.deviceName
      );
      return { connectedPeers: [peer, ...filtered].slice(0, 10) };
    });
  },

  tickNow: () => {
    const current = Date.now();
    const { files, otpExpiresAt, roomId } = get();

    const otpRemainingSeconds = otpExpiresAt
      ? Math.max(0, Math.ceil((otpExpiresAt - current) / 1000))
      : 60;

    // Drop expired, un-pinned files locally (server also deletes them and broadcasts)
    const active = files.filter((f) => isAlive(f, current));

    if (active.length !== files.length) {
      persistFiles(roomId, active);
      set({ now: current, files: active, otpRemainingSeconds });
    } else {
      set({ now: current, otpRemainingSeconds });
    }
  },
}));
