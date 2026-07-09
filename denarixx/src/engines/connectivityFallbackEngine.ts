// ─── Sprint 15: Connectivity Fallback Engine ──────────────────────────────────
// Pure functions — no async, no I/O.
// Detects internet loss and activates glasses offline street safety mode.
// Architecture: Glasses edge AI (primary) → phone fallback → cloud (optional).

import type {
  ConnectivityState,
  StreetSafetyMode,
  ConnectivityFallbackConfig,
  ConnectivityTransition,
} from '@/types/streetSafety';
import type { NetworkReading } from '@/types/offline';
import {
  OFFLINE_MODE_ANNOUNCEMENT,
  ONLINE_RESTORED_ANNOUNCEMENT,
} from '@/types/streetSafety';

// ─── Connectivity Assessment ──────────────────────────────────────────────────

export function assessConnectivity(network: NetworkReading): ConnectivityState {
  switch (network.status) {
    case 'online':
      return network.quality === 'none' ? 'disconnected' : 'connected';
    case 'offline':
      return 'disconnected';
    case 'weak':
      return 'weak';
    case 'reconnecting':
      return 'checking';
    case 'sync-pending':
      return 'connected';
    default:
      return 'disconnected';
  }
}

export function isCloudAvailable(connectivity: ConnectivityState): boolean {
  return connectivity === 'connected';
}

export function shouldActivateFallback(config: ConnectivityFallbackConfig): boolean {
  return (
    config.connectivityState === 'disconnected' ||
    config.connectivityState === 'weak'
  );
}

// ─── Mode Determination ───────────────────────────────────────────────────────

export function determineSafetyMode(
  connectivity: ConnectivityState
): StreetSafetyMode {
  switch (connectivity) {
    case 'connected':
      return 'online';
    case 'disconnected':
      return 'offline';
    case 'weak':
      return 'degraded';
    case 'checking':
      return 'degraded';
    default:
      return 'offline';
  }
}

// ─── Config Factory ───────────────────────────────────────────────────────────

export function buildInitialFallbackConfig(): ConnectivityFallbackConfig {
  return {
    mode: 'online',
    connectivityState: 'connected',
    offlineSince: null,
    lastCloudCallAt: null,
    fallbackActive: false,
    cloudEnhancementAvailable: true,
    announcementPending: null,
  };
}

export function updateFallbackConfig(
  current: ConnectivityFallbackConfig,
  network: NetworkReading,
  tick: number
): ConnectivityFallbackConfig {
  const connectivity = assessConnectivity(network);
  const mode = determineSafetyMode(connectivity);
  const wasOnline = current.connectivityState === 'connected';
  const isNowOffline = connectivity === 'disconnected' || connectivity === 'weak';
  const isNowOnline = connectivity === 'connected';

  const offlineSince =
    isNowOffline && current.offlineSince === null
      ? tick
      : isNowOnline
      ? null
      : current.offlineSince;

  let announcementPending: string | null = null;
  if (!wasOnline && isNowOnline) {
    announcementPending = ONLINE_RESTORED_ANNOUNCEMENT;
  } else if (wasOnline && isNowOffline) {
    announcementPending = OFFLINE_MODE_ANNOUNCEMENT;
  }

  return {
    mode,
    connectivityState: connectivity,
    offlineSince,
    lastCloudCallAt: isNowOnline ? tick : current.lastCloudCallAt,
    fallbackActive: isNowOffline,
    cloudEnhancementAvailable: isNowOnline,
    announcementPending,
  };
}

// ─── Duration Calculation ─────────────────────────────────────────────────────

export function calculateOfflineDurationSeconds(
  config: ConnectivityFallbackConfig,
  currentTick: number,
  ticksPerSecond = 1
): number {
  if (config.offlineSince === null) return 0;
  return Math.max(0, (currentTick - config.offlineSince) / ticksPerSecond);
}

// ─── Announcement ─────────────────────────────────────────────────────────────

export function consumeAnnouncement(
  config: ConnectivityFallbackConfig
): { announcement: string | null; config: ConnectivityFallbackConfig } {
  if (!config.announcementPending) return { announcement: null, config };
  return {
    announcement: config.announcementPending,
    config: { ...config, announcementPending: null },
  };
}

export function getOfflineModeAnnouncement(): string {
  return OFFLINE_MODE_ANNOUNCEMENT;
}

export function getOnlineRestoredAnnouncement(): string {
  return ONLINE_RESTORED_ANNOUNCEMENT;
}

// ─── Transition ───────────────────────────────────────────────────────────────

export function buildConnectivityTransition(
  from: ConnectivityState,
  to: ConnectivityState,
  tick: number
): ConnectivityTransition {
  const modeChange = determineSafetyMode(to);
  const goingOffline = to === 'disconnected' || to === 'weak';
  const spokenAnnouncement = goingOffline
    ? OFFLINE_MODE_ANNOUNCEMENT
    : ONLINE_RESTORED_ANNOUNCEMENT;
  const displayMessage = goingOffline
    ? 'Offline Street Safety Mode active. Glasses edge AI is the primary guardian.'
    : 'Online mode restored. Cloud enhancement available. Safety mode remains active.';

  return {
    from,
    to,
    modeChange,
    spokenAnnouncement,
    displayMessage,
    timestamp: tick,
  };
}

// ─── Fallback Decision ────────────────────────────────────────────────────────

export function getFallbackGuidanceSource(
  config: ConnectivityFallbackConfig
): 'glasses-edge' | 'phone-fallback' | 'cloud-enhanced' {
  if (config.cloudEnhancementAvailable) return 'cloud-enhanced';
  return 'glasses-edge';
}
