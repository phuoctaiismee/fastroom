// Pure TypeScript interfaces and constants safe for browser/client components

export interface SharedFile {
  id: string;
  roomId: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 Data URL
  createdAt: number;
  expiresAt: number;
  senderName?: string;
  senderDevice?: string;
  senderDeviceId?: string;
  isPinned?: boolean; // Pinned files are never auto-deleted
}

export type RoomEvent =
  | { type: 'file_added'; file: SharedFile }
  | { type: 'file_updated'; file: SharedFile }
  | { type: 'file_removed'; fileId: string; roomId: string }
  | { type: 'room_cleared'; roomId: string }
  | { type: 'otp_rotated'; otp: string; expiresAt: number }
  | { type: 'peer_joined'; deviceName: string; deviceId?: string; timestamp: number }
  | { type: 'ping'; timestamp: number };

export interface AvailableRoomSummary {
  roomId: string;
  fileCount: number;
  clientsCount: number;
  createdAt: number;
  lastActivityAt: number;
  hasHost: boolean;
  isAvailable: boolean;
}

export const FILE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_TTL_MS = 60 * 1000; // 60 seconds
