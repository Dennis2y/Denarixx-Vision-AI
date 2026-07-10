/**
 * pwa.ts — Progressive Web App utilities (V10).
 *
 * Server-safe: all browser API calls are guarded with typeof window / navigator checks.
 * All functions are pure or side-effect-isolated so they can be tested in Node.
 */

// ─── Service worker ────────────────────────────────────────────────────────────

/** Register the Denarixx service worker. Call once on app mount (client only). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

// ─── Install detection ─────────────────────────────────────────────────────────

/** Returns true when the app is running in PWA standalone mode (installed). */
export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = navigator as { standalone?: boolean };
  return nav.standalone === true;
}

export type PWADisplayMode = 'standalone' | 'browser';

/** Returns current PWA display mode. */
export function getPWADisplayMode(): PWADisplayMode {
  return isInstalledPWA() ? 'standalone' : 'browser';
}

/**
 * Returns true when the install prompt should be shown.
 * Requires a deferred BeforeInstallPromptEvent AND the app not already installed.
 */
export function shouldShowInstallPrompt(deferredPromptAvailable: boolean): boolean {
  return deferredPromptAvailable && !isInstalledPWA();
}

// ─── Connectivity ──────────────────────────────────────────────────────────────

/** Returns true if the device is currently offline. */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  // navigator.onLine is undefined in Node.js (not a real browser)
  if (typeof navigator.onLine !== 'boolean') return false;
  return !navigator.onLine;
}

export type ConnectionQuality = 'good' | 'degraded' | 'offline';

/** Returns a coarse connection quality rating using the Network Information API where available. */
export function getConnectionQuality(): ConnectionQuality {
  if (typeof navigator === 'undefined') return 'offline';
  if (!navigator.onLine) return 'offline';
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection;
  if (!conn) return 'good';
  const type = conn.effectiveType;
  if (type === 'slow-2g' || type === '2g') return 'degraded';
  if (conn.downlink !== undefined && conn.downlink < 0.5) return 'degraded';
  return 'good';
}

/** Returns a short display label for the connection quality. */
export function connectionLabel(q: ConnectionQuality): string {
  switch (q) {
    case 'good':     return 'Connected';
    case 'degraded': return 'Slow connection';
    case 'offline':  return 'Offline';
  }
}

// ─── Battery ───────────────────────────────────────────────────────────────────

export type BatteryWarningLevel = 'critical' | 'low' | 'ok';

/**
 * Classify a battery level (0–1) into a warning tier.
 * critical ≤ 10%, low ≤ 20%, ok above 20%.
 */
export function classifyBatteryLevel(level: number): BatteryWarningLevel {
  if (level <= 0.10) return 'critical';
  if (level <= 0.20) return 'low';
  return 'ok';
}

/**
 * Returns a spoken/displayed battery warning message, or null when ok.
 * Rounds to nearest whole percent.
 */
export function batteryWarningMessage(level: number): string | null {
  const pct = Math.round(level * 100);
  const cls = classifyBatteryLevel(level);
  if (cls === 'critical') {
    return `Battery critically low at ${pct}%. Please charge immediately and stop the session.`;
  }
  if (cls === 'low') {
    return `Battery low at ${pct}%. Battery-aware mode is active — scan frequency reduced.`;
  }
  return null;
}

// ─── Capabilities ──────────────────────────────────────────────────────────────

export interface CapabilityReport {
  camera: boolean;
  speech: boolean;
  serviceWorker: boolean;
  vibration: boolean;
  speechRecognition: boolean;
}

/**
 * Checks whether the current device supports the APIs required for a full Vision Session.
 * Returns false for all capabilities in Node / SSR.
 */
export function checkCapabilities(): CapabilityReport {
  if (typeof window === 'undefined') {
    return { camera: false, speech: false, serviceWorker: false, vibration: false, speechRecognition: false };
  }
  return {
    camera:           !!(navigator.mediaDevices?.getUserMedia),
    speech:           'speechSynthesis' in window,
    serviceWorker:    'serviceWorker' in navigator,
    vibration:        'vibrate' in navigator,
    speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
  };
}

/**
 * Returns a human-readable status string for each missing capability.
 * Empty array = fully capable.
 */
export function missingCapabilities(report: CapabilityReport): string[] {
  const msgs: string[] = [];
  if (!report.camera)           msgs.push('Camera (getUserMedia) not available — simulation only');
  if (!report.speech)           msgs.push('Speech synthesis not available — audio output disabled');
  if (!report.serviceWorker)    msgs.push('Service worker not supported — offline mode unavailable');
  if (!report.vibration)        msgs.push('Vibration not supported — haptic alerts disabled');
  if (!report.speechRecognition) msgs.push('Speech recognition not available — voice commands disabled');
  return msgs;
}
