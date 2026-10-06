'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function generateShortDeviceId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'dev-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev-server';
  try {
    const raw = localStorage.getItem('fastroom_device_identity');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.deviceId) {
        return parsed.state.deviceId;
      }
    }
  } catch {}

  let id = localStorage.getItem('fastroom_device_id_raw');
  if (!id) {
    id = generateShortDeviceId();
    try {
      localStorage.setItem('fastroom_device_id_raw', id);
    } catch {}
  }
  return id;
}

export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';

  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  }
  if (/iPad/i.test(ua)) {
    return 'iPad';
  }
  if (/Android/i.test(ua)) {
    if (/Samsung/i.test(ua)) return 'Samsung Phone';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    return 'Android Phone';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'Mac Desktop';
  }
  if (/Windows/i.test(ua)) {
    return 'Windows PC';
  }
  if (/Linux/i.test(ua)) {
    return 'Linux PC';
  }

  return 'Web Client';
}

interface DeviceState {
  deviceId: string;
  deviceName: string;
  nickname: string;
  setNickname: (nickname: string) => void;
  getEffectiveName: () => string;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: typeof window !== 'undefined' ? getOrCreateDeviceId() : generateShortDeviceId(),
      deviceName: typeof window !== 'undefined' ? detectDeviceName() : 'Device',
      nickname: '',
      setNickname: (nickname: string) => set({ nickname: nickname.trim() }),
      getEffectiveName: () => {
        const { nickname, deviceName, deviceId } = get();
        if (nickname) return `${nickname} (${deviceName})`;
        return `${deviceName} [${deviceId.slice(-4)}]`;
      },
    }),
    {
      name: 'fastroom_device_identity',
    }
  )
);
