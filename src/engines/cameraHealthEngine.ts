// ─── V14 Camera Health Engine ─────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Monitors camera health, triggers fallback, produces safety guidance.

import type {
  GlassesState,
  CameraFeed,
  GlassesCameraPosition,
  CameraHealthStatus,
} from '@/types/glasses';
import {
  VISION_UNAVAILABLE_MESSAGE,
  CAMERA_DEGRADED_MESSAGE,
  PHONE_FALLBACK_MESSAGE,
} from '@/types/glasses';

// ─── Health Assessment ────────────────────────────────────────────────────────

export function assessCameraHealth(feed: CameraFeed): CameraHealthStatus {
  if (!feed.connected) return 'offline';
  if (feed.latencyMs > 200 || feed.frameQuality < 0.3) return 'failed';
  if (feed.latencyMs > 100 || feed.frameQuality < 0.6) return 'degraded';
  return 'active';
}

export function isCameraUsable(feed: CameraFeed): boolean {
  const health = assessCameraHealth(feed);
  return health === 'active' || health === 'degraded';
}

export function getCriticalFailures(state: GlassesState): CameraFeed[] {
  return state.feeds.filter(
    (f) => f.connected && (f.healthStatus === 'failed' || f.latencyMs > 200),
  );
}

export function getDegradedFeeds(state: GlassesState): CameraFeed[] {
  return state.feeds.filter((f) => f.healthStatus === 'degraded');
}

export function allGlassesCamerasFailed(state: GlassesState): boolean {
  const glassCams = state.feeds.filter((f) => f.position !== 'external');
  return glassCams.every((f) => !f.connected || f.healthStatus === 'failed' || f.healthStatus === 'offline');
}

export function noUsableCameras(state: GlassesState): boolean {
  return !state.feeds.some(isCameraUsable);
}

// ─── Fallback Logic ───────────────────────────────────────────────────────────

export function shouldFallbackToPhone(state: GlassesState): boolean {
  if (state.fallbackActive) return false;     // already on fallback
  if (state.activeSource === 'phone') return false;
  return allGlassesCamerasFailed(state);
}

export function applyPhoneFallback(state: GlassesState): GlassesState {
  return {
    ...state,
    activeSource: 'phone',
    fallbackActive: true,
    fallbackReason: PHONE_FALLBACK_MESSAGE,
  };
}

export function clearFallback(state: GlassesState): GlassesState {
  return {
    ...state,
    fallbackActive: false,
    fallbackReason: null,
    activeSource: state.feeds.find((f) => f.connected && f.healthStatus === 'active')?.position ?? 'none',
  };
}

// ─── Camera Selection ─────────────────────────────────────────────────────────

const SOURCE_PRIORITY: Array<GlassesCameraPosition | 'phone'> = [
  'front', 'external', 'right', 'left', 'phone',
];

export function selectBestCamera(state: GlassesState): GlassesCameraPosition | 'phone' | 'none' {
  for (const source of SOURCE_PRIORITY) {
    if (source === 'phone') return 'phone';
    const feed = state.feeds.find((f) => f.position === source);
    if (feed && isCameraUsable(feed)) return source;
  }
  return 'none';
}

// ─── Safety Guidance ──────────────────────────────────────────────────────────

export function buildFallbackGuidance(state: GlassesState): string {
  if (noUsableCameras(state)) return VISION_UNAVAILABLE_MESSAGE;
  if (shouldFallbackToPhone(state)) return PHONE_FALLBACK_MESSAGE;
  const degraded = getDegradedFeeds(state);
  if (degraded.length > 0) return CAMERA_DEGRADED_MESSAGE;
  return '';
}

export function buildUnavailableMessage(): string {
  return VISION_UNAVAILABLE_MESSAGE;
}

export function buildCameraStatusSummary(state: GlassesState): string {
  const connected = state.feeds.filter((f) => f.connected);
  const active = connected.filter((f) => f.healthStatus === 'active');
  if (connected.length === 0) return 'No cameras connected.';
  return `${active.length} of ${connected.length} cameras active.`;
}

// ─── Battery Warnings ─────────────────────────────────────────────────────────

export function getCamerasBatteryWarning(batteryPct: number): string | null {
  if (batteryPct <= 5) return 'Glasses battery critical. Glasses will shut down soon.';
  if (batteryPct <= 15) return 'Glasses battery low. Consider charging soon.';
  if (batteryPct <= 25) return 'Glasses battery at 25%. Connect to power when possible.';
  return null;
}

// ─── Health score 0–1 ─────────────────────────────────────────────────────────

export function computeOverallHealthScore(state: GlassesState): number {
  const connected = state.feeds.filter((f) => f.connected);
  if (connected.length === 0) return 0;
  const score = connected.reduce((sum, f) => {
    const latencyScore = Math.max(0, 1 - f.latencyMs / 200);
    return sum + f.frameQuality * 0.6 + latencyScore * 0.4;
  }, 0);
  return Math.round((score / connected.length) * 100) / 100;
}
