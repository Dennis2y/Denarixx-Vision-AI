// ─── V14 Glasses Camera Engine ───────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Manages simulated smart-glasses camera feeds and state.

import type {
  GlassesState,
  CameraFeed,
  GlassesCameraPosition,
  CameraHealthStatus,
  GlassesConnectionHealth,
} from '@/types/glasses';
import { CAMERA_PRIVACY } from '@/types/glasses';

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function createDefaultFeed(position: GlassesCameraPosition): CameraFeed {
  const isFront = position === 'front';
  return {
    position,
    healthStatus: isFront ? 'active' : 'standby',
    latencyMs: isFront ? 35 : 80,
    frameQuality: isFront ? 0.92 : 0.75,
    fps: isFront ? 10 : 5,
    connected: isFront,
    lastFrameAt: Date.now(),
    errorMessage: null,
  };
}

let _glassesIdCounter = 0;

export function createGlassesState(deviceName = 'Denarixx Glasses Gen 1'): GlassesState {
  return {
    deviceId: `glasses-${Date.now()}-${++_glassesIdCounter}`,
    deviceName,
    feeds: [
      createDefaultFeed('front'),
      createDefaultFeed('left'),
      createDefaultFeed('right'),
      createDefaultFeed('external'),
    ],
    batteryPct: 85,
    connectionHealth: 'good',
    activeSource: 'front',
    fallbackActive: false,
    fallbackReason: null,
    connectedAt: Date.now(),
    privacy: CAMERA_PRIVACY,
  };
}

// ─── Feed Simulation ──────────────────────────────────────────────────────────

export function simulateFeedTick(feed: CameraFeed, seed: number): CameraFeed {
  if (!feed.connected) return feed;
  const jitter = Math.sin(seed * 7.3 + feed.position.length) * 5;
  const latency = Math.max(10, feed.latencyMs + jitter);
  const quality = Math.max(0.3, Math.min(1, feed.frameQuality + Math.sin(seed * 1.1) * 0.03));
  const newStatus = computeHealthStatus(latency, quality);
  return {
    ...feed,
    latencyMs: Math.round(latency),
    frameQuality: Math.round(quality * 100) / 100,
    healthStatus: newStatus,
    lastFrameAt: Date.now(),
  };
}

export function simulateBatteryDrain(state: GlassesState, ticksElapsed: number): GlassesState {
  const drainPer100Ticks = 0.5; // ~0.5% per 100 ticks
  const newBattery = Math.max(0, state.batteryPct - (ticksElapsed * drainPer100Ticks) / 100);
  return { ...state, batteryPct: Math.round(newBattery * 10) / 10 };
}

// ─── Camera Connect / Disconnect ──────────────────────────────────────────────

export function connectCamera(
  state: GlassesState,
  position: GlassesCameraPosition,
): GlassesState {
  const feeds = state.feeds.map((f) =>
    f.position === position
      ? { ...f, connected: true, healthStatus: 'active' as CameraHealthStatus, errorMessage: null }
      : f,
  );
  return { ...state, feeds, activeSource: position };
}

export function disconnectCamera(
  state: GlassesState,
  position: GlassesCameraPosition,
  reason = 'Manual disconnect',
): GlassesState {
  const feeds = state.feeds.map((f) =>
    f.position === position
      ? { ...f, connected: false, healthStatus: 'offline' as CameraHealthStatus, errorMessage: reason }
      : f,
  );
  const activeStillConnected = feeds.find((f) => f.position === state.activeSource)?.connected;
  const newActive = activeStillConnected
    ? state.activeSource
    : (feeds.find((f) => f.connected)?.position ?? 'none');
  return {
    ...state,
    feeds,
    activeSource: newActive as GlassesState['activeSource'],
    fallbackActive: state.fallbackActive,
    fallbackReason: state.fallbackReason,
  };
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export function getActiveFeed(state: GlassesState): CameraFeed | null {
  return state.feeds.find((f) => f.position === state.activeSource && f.connected) ?? null;
}

export function getCamerasByHealth(state: GlassesState, status: CameraHealthStatus): CameraFeed[] {
  return state.feeds.filter((f) => f.healthStatus === status);
}

export function getConnectedFeeds(state: GlassesState): CameraFeed[] {
  return state.feeds.filter((f) => f.connected);
}

export function hasAnyConnectedCamera(state: GlassesState): boolean {
  return state.feeds.some((f) => f.connected);
}

// ─── Health Computation ───────────────────────────────────────────────────────

export function computeHealthStatus(latencyMs: number, frameQuality: number): CameraHealthStatus {
  if (latencyMs > 200 || frameQuality < 0.3) return 'failed';
  if (latencyMs > 100 || frameQuality < 0.6) return 'degraded';
  return 'active';
}

export function computeConnectionHealth(feeds: CameraFeed[]): GlassesConnectionHealth {
  const connected = feeds.filter((f) => f.connected);
  if (connected.length === 0) return 'lost';
  const avgQuality = connected.reduce((s, f) => s + f.frameQuality, 0) / connected.length;
  const avgLatency = connected.reduce((s, f) => s + f.latencyMs, 0) / connected.length;
  if (avgQuality >= 0.85 && avgLatency < 50) return 'excellent';
  if (avgQuality >= 0.6 && avgLatency < 100) return 'good';
  return 'degraded';
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCameraPosition(position: GlassesCameraPosition): string {
  const names: Record<GlassesCameraPosition, string> = {
    front: 'Front Camera',
    left: 'Left Peripheral',
    right: 'Right Peripheral',
    external: 'External Camera',
  };
  return names[position];
}

export function formatConnectionHealth(health: GlassesConnectionHealth): string {
  const map: Record<GlassesConnectionHealth, string> = {
    excellent: '🟢 Excellent',
    good: '🟡 Good',
    degraded: '🟠 Degraded',
    lost: '🔴 Lost',
  };
  return map[health];
}
