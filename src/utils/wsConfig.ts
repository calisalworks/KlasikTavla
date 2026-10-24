import { Capacitor } from '@capacitor/core';

export interface WebSocketConfigResult {
  url: string | null;
  isNativeWithoutServer: boolean;
  errorMessage?: string;
}

/**
 * Resolves the appropriate WebSocket URL depending on runtime environment:
 * 1. If VITE_WS_SERVER_URL is configured in environment, use it.
 * 2. If running on native platform (Capacitor Android/iOS) and no remote server is specified:
 *    Return null to prevent erroneous loopback connection to phone localhost,
 *    and allow the UI to inform the player gracefully.
 * 3. In standard web browser: use current host (${protocol}//${window.location.host}/ws).
 */
export function getWebSocketConfig(): WebSocketConfigResult {
  const envServer = import.meta.env.VITE_WS_SERVER_URL;
  if (typeof envServer === 'string' && envServer.trim() !== '') {
    let clean = envServer.trim();
    if (clean.startsWith('http://')) {
      clean = clean.replace('http://', 'ws://');
    } else if (clean.startsWith('https://')) {
      clean = clean.replace('https://', 'wss://');
    } else if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
      clean = `wss://${clean}`;
    }
    const finalUrl = clean.endsWith('/ws') ? clean : `${clean.replace(/\/$/, '')}/ws`;
    return { url: finalUrl, isNativeWithoutServer: false };
  }

  // Detect native Capacitor Android / iOS runtime
  const isNative =
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && typeof (window as any).Capacitor !== 'undefined');

  if (isNative) {
    return {
      url: null,
      isNativeWithoutServer: true,
      errorMessage:
        'Online oyun sunucusu henüz tanımlanmadı (VITE_WS_SERVER_URL). Tekli Yapay Zeka modunu hemen oynayabilirsiniz.',
    };
  }

  // Standard web browser fallback
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    url: `${protocol}//${window.location.host}/ws`,
    isNativeWithoutServer: false,
  };
}
