import { SharedFile, RoomEvent, AvailableRoomSummary, FILE_TTL_MS, OTP_TTL_MS } from './room-types';

export * from './room-types';

interface RoomState {
  id: string;
  files: Map<string, SharedFile>;
  subscribers: Set<(event: RoomEvent) => void>;
  timers: Map<string, NodeJS.Timeout>;
  // Security & 60s OTP
  currentOtp: string;
  prevOtp?: string;
  otpExpiresAt: number;
  otpInterval?: NodeJS.Timeout;
  authorizedTokens: Set<string>;
  createdAt: number;
  lastActivityAt: number;
  hasHost: boolean;
}

interface SerializedRoom {
  id: string;
  currentOtp: string;
  prevOtp?: string;
  otpExpiresAt: number;
  authorizedTokens: string[];
  files: SharedFile[];
  createdAt: number;
  lastActivityAt: number;
  hasHost: boolean;
}

const OTP_SECRET = 'fastroom_secret_otp_salt_2026';

export function getOtpForTimeWindow(roomId: string, timeWindowIndex: number): string {
  const normalizedId = roomId.trim().toLowerCase();
  const input = `${normalizedId}:${timeWindowIndex}:${OTP_SECRET}`;

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const otpNum = (positiveHash % 900000) + 100000;
  return otpNum.toString();
}

export function getCurrentRoomOtpData(roomId: string): {
  currentOtp: string;
  prevOtp: string;
  expiresAt: number;
  remainingSeconds: number;
} {
  const now = Date.now();
  const windowIndex = Math.floor(now / OTP_TTL_MS); // 60,000 ms
  const expiresAt = (windowIndex + 1) * OTP_TTL_MS;
  const remainingSeconds = Math.max(1, Math.ceil((expiresAt - now) / 1000));

  const currentOtp = getOtpForTimeWindow(roomId, windowIndex);
  const prevOtp = getOtpForTimeWindow(roomId, windowIndex - 1);

  return {
    currentOtp,
    prevOtp,
    expiresAt,
    remainingSeconds,
  };
}

class FastroomManager {
  private rooms: Map<string, RoomState> = new Map();

  private getStorageFilePath(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');
    return path.join(os.tmpdir(), 'fastroom_ephemeral_store.json');
  }

  private saveDiskState() {
    if (typeof window !== 'undefined') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const filePath = this.getStorageFilePath();
      const exportData: Record<string, SerializedRoom> = {};
      const now = Date.now();

      for (const [roomId, room] of this.rooms.entries()) {
        const activeFiles: SharedFile[] = [];
        for (const file of room.files.values()) {
          if (file.isPinned || file.expiresAt > now) {
            activeFiles.push(file);
          }
        }

        exportData[roomId] = {
          id: room.id,
          currentOtp: room.currentOtp,
          prevOtp: room.prevOtp,
          otpExpiresAt: room.otpExpiresAt,
          authorizedTokens: Array.from(room.authorizedTokens),
          files: activeFiles,
          createdAt: room.createdAt,
          lastActivityAt: room.lastActivityAt,
          hasHost: room.hasHost,
        };
      }

      fs.writeFileSync(filePath, JSON.stringify(exportData), 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  private loadDiskState(roomId: string) {
    if (typeof window !== 'undefined') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const filePath = this.getStorageFilePath();
      if (!fs.existsSync(filePath)) return;

      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw) return;

      const exportData: Record<string, SerializedRoom> = JSON.parse(raw);
      const normalizedId = roomId.trim().toLowerCase();
      const savedRoom = exportData[normalizedId];

      if (savedRoom) {
        let room = this.rooms.get(normalizedId);
        const now = Date.now();

        if (!room) {
          const otpData = getCurrentRoomOtpData(normalizedId);
          room = {
            id: normalizedId,
            files: new Map(),
            subscribers: new Set(),
            timers: new Map(),
            currentOtp: savedRoom.currentOtp || otpData.currentOtp,
            prevOtp: savedRoom.prevOtp || otpData.prevOtp,
            otpExpiresAt: savedRoom.otpExpiresAt || otpData.expiresAt,
            authorizedTokens: new Set(savedRoom.authorizedTokens || []),
            createdAt: savedRoom.createdAt || now,
            lastActivityAt: savedRoom.lastActivityAt || now,
            hasHost: savedRoom.hasHost || false,
          };
          this.rooms.set(normalizedId, room);
        } else {
          if (savedRoom.hasHost) {
            room.hasHost = true;
          }
          if (Array.isArray(savedRoom.authorizedTokens)) {
            for (const tok of savedRoom.authorizedTokens) {
              room.authorizedTokens.add(tok);
            }
          }
        }

        // Sync files
        if (Array.isArray(savedRoom.files)) {
          for (const file of savedRoom.files) {
            if (file.isPinned || file.expiresAt > now) {
              if (!room.files.has(file.id)) {
                room.files.set(file.id, file);
                if (!file.isPinned) {
                  const remaining = Math.max(1000, file.expiresAt - now);
                  const timer = setTimeout(() => {
                    this.removeFile(normalizedId, file.id);
                  }, remaining);
                  room.timers.set(file.id, timer);
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  public getOrCreateRoom(roomId: string, isHost = false): RoomState {
    const normalizedId = roomId.trim().toLowerCase();
    this.loadDiskState(normalizedId);
    let room = this.rooms.get(normalizedId);
    const now = Date.now();
    const otpData = getCurrentRoomOtpData(normalizedId);

    if (!room) {
      room = {
        id: normalizedId,
        files: new Map(),
        subscribers: new Set(),
        timers: new Map(),
        currentOtp: otpData.currentOtp,
        prevOtp: otpData.prevOtp,
        otpExpiresAt: otpData.expiresAt,
        authorizedTokens: new Set(),
        createdAt: now,
        lastActivityAt: now,
        hasHost: isHost,
      };

      this.rooms.set(normalizedId, room);
      this.saveDiskState();
    } else {
      room.lastActivityAt = now;
      room.currentOtp = otpData.currentOtp;
      room.prevOtp = otpData.prevOtp;
      room.otpExpiresAt = otpData.expiresAt;
      if (isHost) {
        room.hasHost = true;
        this.saveDiskState();
      }
    }
    return room;
  }

  public getAvailableRooms(): AvailableRoomSummary[] {
    const list: AvailableRoomSummary[] = [];

    for (const [id, room] of this.rooms.entries()) {
      const isAlive = room.subscribers.size > 0 || room.files.size > 0 || room.hasHost;

      if (isAlive) {
        list.push({
          roomId: id,
          fileCount: room.files.size,
          clientsCount: room.subscribers.size,
          createdAt: room.createdAt,
          lastActivityAt: room.lastActivityAt,
          hasHost: room.hasHost || room.subscribers.size > 0,
          isAvailable: true,
        });
      } else {
        if (room.otpInterval) clearInterval(room.otpInterval);
        this.rooms.delete(id);
      }
    }

    return list.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  public getRoomStatus(roomId: string): {
    roomId: string;
    exists: boolean;
    isAvailable: boolean;
    fileCount: number;
    clientsCount: number;
    hasHost: boolean;
  } {
    const normalizedId = roomId.trim().toLowerCase();
    this.loadDiskState(normalizedId);
    const room = this.rooms.get(normalizedId);
    if (!room) {
      return {
        roomId: normalizedId,
        exists: false,
        isAvailable: false,
        fileCount: 0,
        clientsCount: 0,
        hasHost: false,
      };
    }

    const isAvailable = room.subscribers.size > 0 || room.files.size > 0 || room.hasHost;

    return {
      roomId: normalizedId,
      exists: isAvailable,
      isAvailable,
      fileCount: room.files.size,
      clientsCount: room.subscribers.size,
      hasHost: room.hasHost || room.subscribers.size > 0,
    };
  }

  public getRoomOtp(
    roomId: string,
    isHost = false
  ): { otp: string; expiresAt: number; remainingSeconds: number } {
    const normalizedId = roomId.trim().toLowerCase();
    this.getOrCreateRoom(normalizedId, isHost);
    const otpData = getCurrentRoomOtpData(normalizedId);

    return {
      otp: otpData.currentOtp,
      expiresAt: otpData.expiresAt,
      remainingSeconds: otpData.remainingSeconds,
    };
  }

  public verifyOtp(
    roomId: string,
    candidateOtp: string,
    deviceName = 'Mobile Device',
    deviceId?: string
  ): { success: boolean; authToken?: string; error?: string } {
    const normalizedId = roomId.trim().toLowerCase();
    this.loadDiskState(normalizedId);
    let room = this.rooms.get(normalizedId);

    if (!room) {
      room = this.getOrCreateRoom(normalizedId, false);
    }

    const cleanOtp = candidateOtp.trim();
    const now = Date.now();
    const windowIndex = Math.floor(now / OTP_TTL_MS);

    // Compute OTPs for prev, current, and next windows (handle client clock skew)
    const currentOtp = getOtpForTimeWindow(normalizedId, windowIndex);
    const prevOtp = getOtpForTimeWindow(normalizedId, windowIndex - 1);
    const nextOtp = getOtpForTimeWindow(normalizedId, windowIndex + 1);

    console.log(`[OTP verify] room=${normalizedId} window=${windowIndex} candidate=${cleanOtp} current=${currentOtp} prev=${prevOtp} next=${nextOtp}`);

    // Valid if matches current, previous (grace period), or next window (client clock slightly ahead)
    const isValid =
      cleanOtp === currentOtp ||
      cleanOtp === prevOtp ||
      cleanOtp === nextOtp ||
      cleanOtp === room.currentOtp ||
      (room.prevOtp && cleanOtp === room.prevOtp);

    if (!isValid) {
      console.log(`[OTP verify] FAILED for room=${normalizedId}`);
      return { success: false, error: 'Mã OTP không chính xác hoặc đã hết hạn.' };
    }

    const authToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    room.authorizedTokens.add(authToken);
    room.lastActivityAt = Date.now();
    this.saveDiskState();

    // Broadcast to desktop that a peer joined
    this.broadcast(roomId, {
      type: 'peer_joined',
      deviceName,
      deviceId,
      timestamp: Date.now(),
    });

    return { success: true, authToken };
  }

  public isAuthorized(roomId: string, authToken?: string | null): boolean {
    if (!authToken) return false;
    const normalizedId = roomId.trim().toLowerCase();
    this.loadDiskState(normalizedId);
    const room = this.rooms.get(normalizedId);
    if (!room) return false;
    return room.authorizedTokens.has(authToken);
  }

  public subscribe(
    roomId: string,
    listener: (event: RoomEvent) => void,
    isHost = false
  ): () => void {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.getOrCreateRoom(normalizedId, isHost);
    room.subscribers.add(listener);
    room.lastActivityAt = Date.now();

    return () => {
      room.subscribers.delete(listener);
      room.lastActivityAt = Date.now();
      if (room.subscribers.size === 0 && room.files.size === 0) {
        if (room.otpInterval) clearInterval(room.otpInterval);
        this.rooms.delete(normalizedId);
        this.saveDiskState();
      }
    };
  }

  public broadcast(roomId: string, event: RoomEvent) {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.rooms.get(normalizedId);
    if (!room) return;

    room.lastActivityAt = Date.now();
    const deadListeners: ((event: RoomEvent) => void)[] = [];

    for (const listener of room.subscribers) {
      try {
        listener(event);
      } catch {
        deadListeners.push(listener);
      }
    }

    // Clean up any dead sockets
    for (const dead of deadListeners) {
      room.subscribers.delete(dead);
    }

    if (room.subscribers.size === 0 && room.files.size === 0) {
      if (room.otpInterval) clearInterval(room.otpInterval);
      this.rooms.delete(normalizedId);
      this.saveDiskState();
    }
  }

  public addFile(
    roomId: string,
    payload: Omit<SharedFile, 'createdAt' | 'expiresAt'>
  ): SharedFile {
    const room = this.getOrCreateRoom(roomId);
    const now = Date.now();
    const expiresAt = now + FILE_TTL_MS;

    const file: SharedFile = {
      ...payload,
      createdAt: now,
      expiresAt,
    };

    room.files.set(file.id, file);
    room.lastActivityAt = now;

    const timer = setTimeout(() => {
      this.removeFile(roomId, file.id);
    }, FILE_TTL_MS);

    room.timers.set(file.id, timer);

    this.saveDiskState();

    this.broadcast(roomId, {
      type: 'file_added',
      file,
    });

    return file;
  }

  public removeFile(roomId: string, fileId: string): boolean {
    const room = this.getOrCreateRoom(roomId);
    const timer = room.timers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      room.timers.delete(fileId);
    }

    const existed = room.files.delete(fileId);
    if (existed) {
      room.lastActivityAt = Date.now();
      this.saveDiskState();
      this.broadcast(roomId, {
        type: 'file_removed',
        fileId,
        roomId,
      });
    }
    return existed;
  }

  public clearRoom(roomId: string) {
    const room = this.getOrCreateRoom(roomId);
    for (const timer of room.timers.values()) {
      clearTimeout(timer);
    }
    room.timers.clear();
    room.files.clear();
    room.lastActivityAt = Date.now();
    this.saveDiskState();

    this.broadcast(roomId, {
      type: 'room_cleared',
      roomId,
    });
  }

  public setFilePinned(roomId: string, fileId: string, pinned: boolean): SharedFile | null {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.rooms.get(normalizedId);
    if (!room) return null;
    const existing = room.files.get(fileId);
    if (!existing) return null;

    // Always reset the current auto-delete timer first
    const oldTimer = room.timers.get(fileId);
    if (oldTimer) {
      clearTimeout(oldTimer);
      room.timers.delete(fileId);
    }

    const now = Date.now();
    let updated: SharedFile;

    if (pinned) {
      // Pinned: no timer at all -> file survives until manually deleted / room cleared
      updated = { ...existing, isPinned: true };
    } else {
      // Unpinned: restart a fresh 5-minute countdown
      updated = { ...existing, isPinned: false, expiresAt: now + FILE_TTL_MS };
      const timer = setTimeout(() => {
        this.removeFile(normalizedId, fileId);
      }, FILE_TTL_MS);
      room.timers.set(fileId, timer);
    }

    room.files.set(fileId, updated);
    room.lastActivityAt = now;
    this.saveDiskState();
    this.broadcast(normalizedId, { type: 'file_updated', file: updated });
    return updated;
  }

  public getActiveFiles(roomId: string): SharedFile[] {
    const normalizedId = roomId.trim().toLowerCase();
    this.loadDiskState(normalizedId);
    const room = this.rooms.get(normalizedId);
    if (!room) return [];

    const now = Date.now();
    const active: SharedFile[] = [];

    for (const file of room.files.values()) {
      if (file.isPinned || file.expiresAt > now) {
        active.push(file);
      } else {
        room.files.delete(file.id);
      }
    }

    return active.sort((a, b) => b.createdAt - a.createdAt);
  }

  public getConnectedClientsCount(roomId: string): number {
    const room = this.rooms.get(roomId.trim().toLowerCase());
    return room ? room.subscribers.size : 0;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __fastroomManager: FastroomManager | undefined;
}

export const fastroomManager = globalThis.__fastroomManager ?? new FastroomManager();
globalThis.__fastroomManager = fastroomManager;
