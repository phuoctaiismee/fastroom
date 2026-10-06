// Client utility functions: sound, clipboard, download, formatters

export function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // First note (D5 ~ 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);

    // Second note (A5 ~ 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore autoplay restriction before first user gesture
  }
}

// Convert base64 data to Blob synchronously (fast 0ms, avoids losing user gesture)
export function base64ToBlob(base64Data: string, contentType = 'image/png'): Blob {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

// Prepare an image Blob that strictly fits within Windows Clipboard History limit (4MB max)
export async function prepareClipboardImageBlob(dataUrl: string): Promise<Blob> {
  const isPng = dataUrl.startsWith('data:image/png');
  const base64Part = dataUrl.split(',')[1] || '';

  // If already PNG and raw size is strictly <= 3.5MB, return directly
  if (isPng) {
    const rawSize = Math.round((base64Part.length * 3) / 4);
    if (rawSize <= 3.5 * 1024 * 1024) {
      return base64ToBlob(base64Part, 'image/png');
    }
  }

  // Otherwise, load into Image and render via canvas with safe dimensions (<= 2048px)
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Limit max dimension to 2048px so PNG stays well under 3.5MB while retaining ultra-sharp detail
      const maxDim = 2048;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo Canvas 2D'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Không thể tạo file ảnh PNG'));
        }
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Không thể nạp ảnh'));
    img.src = dataUrl;
  });
}

export async function copyImageToClipboard(
  dataUrl: string
): Promise<{ success: boolean; type: 'image' | 'text' | 'insecure'; error?: string }> {
  // Check if secure context (localhost or HTTPS)
  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : true;
  if (!isSecure) {
    return {
      success: false,
      type: 'insecure',
      error: 'Vui lòng mở http://localhost:3000 trên máy tính để trình duyệt cấp quyền copy ảnh trực tiếp vào Clipboard Windows.',
    };
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return {
      success: false,
      type: 'text',
      error: 'Trình duyệt hiện tại không hỗ trợ ClipboardItem API.',
    };
  }

  try {
    const isPng = dataUrl.startsWith('data:image/png');
    const base64Part = dataUrl.split(',')[1] || '';
    const approxBytes = Math.round((base64Part.length * 3) / 4);

    let pngBlob: Blob;
    // Fast path: if already PNG and size <= 3.5MB, synchronous decode prevents losing user activation
    if (isPng && approxBytes <= 3.5 * 1024 * 1024) {
      pngBlob = base64ToBlob(base64Part, 'image/png');
    } else {
      // Scaled/optimized path: guarantees size <= 3.5MB (< 4MB limit of Windows Win+V History)
      pngBlob = await prepareClipboardImageBlob(dataUrl);
    }

    const clipboardItem = new ClipboardItem({
      'image/png': pngBlob,
    });

    await navigator.clipboard.write([clipboardItem]);
    return { success: true, type: 'image' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi sao chép ảnh vào Clipboard:', err);

    // Fallback to text copy
    try {
      await navigator.clipboard.writeText(dataUrl);
      return { success: true, type: 'text', error: errMsg };
    } catch {
      return { success: false, type: 'text', error: errMsg };
    }
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older environments
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
