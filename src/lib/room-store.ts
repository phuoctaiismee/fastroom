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
      // Don't delete the room immediately — client may be reconnecting.
      // Schedule a deferred cleanup after 30s, only if truly empty.
      setTimeout(() => {
        const current = this.rooms.get(normalizedId);
        if (
          current &&
          current.subscribers.size === 0 &&
          current.files.size === 0 &&
          !current.hasHost
        ) {
          if (current.otpInterval) clearInterval(current.otpInterval);
          this.rooms.delete(normalizedId);
          this.saveDiskState();
        }
      }, 30_000);
    };
  }

  public broadcast(roomId: string, event: RoomEvent) {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.rooms.get(normalizedId);

    // Push event to Redis for cross-serverless event distribution if configured
    if (IS_REDIS_ENABLED) {
      redisCommand([
        'RPUSH',
        `fastroom:events:${normalizedId}`,
        JSON.stringify({ ...event, _ts: Date.now() }),
      ]).catch(() => {});
      redisCommand(['EXPIRE', `fastroom:events:${normalizedId}`, 300]).catch(() => {});
    }

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

    // Clean up dead sockets only
    for (const dead of deadListeners) {
      room.subscribers.delete(dead);
    }
  }

  public async addFileAsync(
    roomId: string,
    payload: Omit<SharedFile, 'createdAt' | 'expiresAt'>
  ): Promise<SharedFile> {
    const normalizedId = roomId.trim().toLowerCase();
    const file = this.addFile(normalizedId, payload);

    if (IS_REDIS_ENABLED) {
      try {
        const fileKey = `fastroom:file:${normalizedId}:${file.id}`;
        const setKey = `fastroom:room:${normalizedId}:files`;
        const payloadStr = JSON.stringify(file);

        await Promise.all([
          redisCommand(['SET', fileKey, payloadStr, 'EX', 300]),
          redisCommand(['SADD', setKey, file.id]),
          redisCommand(['EXPIRE', setKey, 300]),
        ]);
      } catch (err) {
        console.error('[Redis addFile error]', err);
      }
    }

    return file;
  }

  public addFile(
    roomId: string,
    payload: Omit<SharedFile, 'createdAt' | 'expiresAt'>
  ): SharedFile {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.getOrCreateRoom(normalizedId);
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
      this.removeFile(normalizedId, file.id);
    }, FILE_TTL_MS);

    room.timers.set(file.id, timer);
    this.saveDiskState();

    this.broadcast(normalizedId, {
      type: 'file_added',
      file,
    });

    return file;
  }

  public async removeFileAsync(roomId: string, fileId: string): Promise<boolean> {
    const normalizedId = roomId.trim().toLowerCase();
    const existed = this.removeFile(normalizedId, fileId);

    if (IS_REDIS_ENABLED) {
      try {
        await Promise.all([
          redisCommand(['DEL', `fastroom:file:${normalizedId}:${fileId}`]),
          redisCommand(['SREM', `fastroom:room:${normalizedId}:files`, fileId]),
        ]);
      } catch {}
    }

    return existed;
  }

  public removeFile(roomId: string, fileId: string): boolean {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.getOrCreateRoom(normalizedId);
    const timer = room.timers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      room.timers.delete(fileId);
    }

    const existed = room.files.delete(fileId);
    if (existed) {
      room.lastActivityAt = Date.now();
      this.saveDiskState();
      this.broadcast(normalizedId, {
        type: 'file_removed',
        fileId,
        roomId: normalizedId,
      });
    }
    return existed;
  }

  public async clearRoomAsync(roomId: string) {
    const normalizedId = roomId.trim().toLowerCase();
    this.clearRoom(normalizedId);

    if (IS_REDIS_ENABLED) {
      try {
        const fileIds = await redisCommand<string[]>(['SMEMBERS', `fastroom:room:${normalizedId}:files`]);
        if (Array.isArray(fileIds)) {
          for (const id of fileIds) {
            redisCommand(['DEL', `fastroom:file:${normalizedId}:${id}`]).catch(() => {});
          }
        }
        await redisCommand(['DEL', `fastroom:room:${normalizedId}:files`]);
      } catch {}
    }
  }

  public clearRoom(roomId: string) {
    const normalizedId = roomId.trim().toLowerCase();
    const room = this.getOrCreateRoom(normalizedId);
    for (const timer of room.timers.values()) {
      clearTimeout(timer);
    }
    room.timers.clear();
    room.files.clear();
    room.lastActivityAt = Date.now();
    this.saveDiskState();

    this.broadcast(normalizedId, {
      type: 'room_cleared',
      roomId: normalizedId,
    });
  }

  public async setFilePinnedAsync(roomId: string, fileId: string, pinned: boolean): Promise<SharedFile | null> {
    const normalizedId = roomId.trim().toLowerCase();
    const updated = this.setFilePinned(normalizedId, fileId, pinned);

    if (IS_REDIS_ENABLED && updated) {
      try {
        const fileKey = `fastroom:file:${normalizedId}:${fileId}`;
        const payloadStr = JSON.stringify(updated);
        if (pinned) {
          await redisCommand(['SET', fileKey, payloadStr, 'EX', 86400]); // 24h for pinned
        } else {
          await redisCommand(['SET', fileKey, payloadStr, 'EX', 300]); // 5m for unpinned
        }
      } catch {}
    }

    return updated;
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

  public async getActiveFilesAsync(roomId: string): Promise<SharedFile[]> {
    const normalizedId = roomId.trim().toLowerCase();
    const localFiles = this.getActiveFiles(normalizedId);

    if (!IS_REDIS_ENABLED) {
      return localFiles;
    }

    try {
      const fileIds = await redisCommand<string[]>(['SMEMBERS', `fastroom:room:${normalizedId}:files`]);
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return localFiles;
      }

      const fetchedFiles: SharedFile[] = [];
      const now = Date.now();

      for (const id of fileIds) {
        const raw = await redisCommand<string>(['GET', `fastroom:file:${normalizedId}:${id}`]);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SharedFile;
            if (parsed.isPinned || parsed.expiresAt > now) {
              fetchedFiles.push(parsed);
            }
          } catch {}
        }
      }

      // Merge local and Redis files without duplicates
      const fileMap = new Map<string, SharedFile>();
      for (const f of localFiles) fileMap.set(f.id, f);
      for (const f of fetchedFiles) fileMap.set(f.id, f);

      return Array.from(fileMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return localFiles;
    }
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

const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.STORAGE_REST_API_URL ||
  process.env.REDIS_REST_API_URL;

const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.STORAGE_REST_API_TOKEN ||
  process.env.REDIS_REST_API_TOKEN;

export const IS_REDIS_ENABLED = !!(REDIS_URL && REDIS_TOKEN);

export async function redisCommand<T = unknown>(command: (string | number)[]): Promise<T | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result as T;
  } catch (err) {
    console.error('[Redis error]', err);
    return null;
  }
}

export async function fetchRedisEvents(roomId: string, start = 0): Promise<RoomEvent[]> {
  if (!IS_REDIS_ENABLED) return [];
  const normalizedId = roomId.trim().toLowerCase();
  const rawList = await redisCommand<string[]>(['LRANGE', `fastroom:events:${normalizedId}`, start, -1]);
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item) => {
      try {
        return JSON.parse(item) as RoomEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is RoomEvent => e !== null);
}

declare global {
  // eslint-disable-next-line no-var
  var __fastroomManager: FastroomManager | undefined;
}

export const fastroomManager = globalThis.__fastroomManager ?? new FastroomManager();
globalThis.__fastroomManager = fastroomManager;

