// ─── Sprint 14: Network Monitor Engine ───────────────────────────────────────
// Pure functions — no async, no I/O.
// Tracks network status, quality, and connection transitions.

import type {
  NetworkReading,
  NetworkStatus,
  NetworkQuality,
} from '@/types/offline';
import {
  DEFAULT_NETWORK_READING,
  WEAK_CONNECTION_THRESHOLD_KBPS,
  POOR_LATENCY_THRESHOLD_MS,
} from '@/types/offline';

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createNetworkReading(
  overrides: Partial<NetworkReading> = {},
): NetworkReading {
  return { ...DEFAULT_NETWORK_READING, ...overrides };
}

// ─── Status Detection ─────────────────────────────────────────────────────────

export function detectNetworkStatus(
  isConnected: boolean,
  bandwidthKbps: number,
  latencyMs: number,
  reconnectAttempts: number,
  hasPendingSync: boolean,
): NetworkStatus {
  if (!isConnected) {
    if (reconnectAttempts > 0) return 'reconnecting';
    return 'offline';
  }
  if (isWeakConnection(bandwidthKbps, latencyMs)) return 'weak';
  if (hasPendingSync) return 'sync-pending';
  return 'online';
}

export function isWeakConnection(
  bandwidthKbps: number,
  latencyMs: number,
): boolean {
  return (
    bandwidthKbps < WEAK_CONNECTION_THRESHOLD_KBPS ||
    latencyMs > POOR_LATENCY_THRESHOLD_MS
  );
}

export function estimateQuality(
  bandwidthKbps: number,
  latencyMs: number,
): NetworkQuality {
  if (bandwidthKbps === 0 && latencyMs === 0) return 'none';
  if (bandwidthKbps >= 5_000 && latencyMs <= 100) return 'excellent';
  if (bandwidthKbps >= 1_000 && latencyMs <= 300) return 'good';
  if (bandwidthKbps >= 100 && latencyMs <= 1_000) return 'poor';
  return 'none';
}

// ─── State Transitions ────────────────────────────────────────────────────────

export function goOnline(
  reading: NetworkReading,
  now: number,
  bandwidthKbps = 10_000,
  latencyMs = 20,
): NetworkReading {
  return {
    ...reading,
    status: 'online',
    quality: estimateQuality(bandwidthKbps, latencyMs),
    lastOnlineAt: now,
    offlineDurationMs: 0,
    reconnectAttempts: 0,
    bandwidthEstimateKbps: bandwidthKbps,
    latencyMs,
  };
}

export function goOffline(reading: NetworkReading, now: number): NetworkReading {
  const wasOnline = reading.status === 'online' || reading.status === 'weak';
  return {
    ...reading,
    status: 'offline',
    quality: 'none',
    lastOnlineAt: wasOnline ? now : reading.lastOnlineAt,
    bandwidthEstimateKbps: 0,
    latencyMs: 0,
  };
}

export function goWeak(
  reading: NetworkReading,
  bandwidthKbps: number,
  latencyMs: number,
): NetworkReading {
  return {
    ...reading,
    status: 'weak',
    quality: estimateQuality(bandwidthKbps, latencyMs),
    bandwidthEstimateKbps: bandwidthKbps,
    latencyMs,
  };
}

export function goReconnecting(reading: NetworkReading): NetworkReading {
  return {
    ...reading,
    status: 'reconnecting',
    reconnectAttempts: reading.reconnectAttempts + 1,
  };
}

export function markSynced(reading: NetworkReading, now: number): NetworkReading {
  return {
    ...reading,
    lastSyncAt: now,
    status: reading.status === 'sync-pending' ? 'online' : reading.status,
  };
}

export function markSyncPending(reading: NetworkReading): NetworkReading {
  if (reading.status === 'offline' || reading.status === 'reconnecting') {
    return reading; // can't mark sync-pending while offline
  }
  return { ...reading, status: 'sync-pending' };
}

export function updateOfflineDuration(
  reading: NetworkReading,
  now: number,
): NetworkReading {
  if (reading.status !== 'offline' && reading.status !== 'reconnecting') {
    return reading;
  }
  const start = reading.lastOnlineAt > 0 ? reading.lastOnlineAt : now;
  return {
    ...reading,
    offlineDurationMs: Math.max(0, now - start),
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function isOnline(reading: NetworkReading): boolean {
  return reading.status === 'online' || reading.status === 'weak' || reading.status === 'sync-pending';
}

export function isOffline(reading: NetworkReading): boolean {
  return reading.status === 'offline' || reading.status === 'reconnecting';
}

export function shouldAttemptReconnect(reading: NetworkReading): boolean {
  return reading.status === 'offline' && reading.reconnectAttempts < 10;
}

export function shouldThrottleRequests(reading: NetworkReading): boolean {
  return reading.status === 'weak' || reading.bandwidthEstimateKbps < 200;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function getOfflineDurationHuman(ms: number): string {
  if (ms < 1_000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function getStatusLabel(status: NetworkStatus): string {
  switch (status) {
    case 'online':       return 'Online';
    case 'offline':      return 'Offline';
    case 'weak':         return 'Weak connection';
    case 'reconnecting': return 'Reconnecting…';
    case 'sync-pending': return 'Sync pending';
  }
}

export function getQualityLabel(quality: NetworkQuality): string {
  switch (quality) {
    case 'excellent': return 'Excellent';
    case 'good':      return 'Good';
    case 'poor':      return 'Poor';
    case 'none':      return 'No connection';
  }
}

export function getStatusColor(status: NetworkStatus): string {
  switch (status) {
    case 'online':       return 'green';
    case 'weak':         return 'yellow';
    case 'sync-pending': return 'blue';
    case 'reconnecting': return 'orange';
    case 'offline':      return 'red';
  }
}

export function getQualityColor(quality: NetworkQuality): string {
  switch (quality) {
    case 'excellent': return 'green';
    case 'good':      return 'green';
    case 'poor':      return 'yellow';
    case 'none':      return 'red';
  }
}

export function formatBandwidth(kbps: number): string {
  if (kbps === 0) return 'No signal';
  if (kbps < 1_000) return `${kbps} Kbps`;
  return `${(kbps / 1_000).toFixed(1)} Mbps`;
}

export function formatLatency(ms: number): string {
  if (ms === 0) return '—';
  return `${ms}ms`;
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export function buildNetworkDiagnostic(reading: NetworkReading): {
  status: string;
  quality: string;
  bandwidth: string;
  latency: string;
  offlineDuration: string;
  lastSync: string;
  reconnectAttempts: number;
} {
  return {
    status: getStatusLabel(reading.status),
    quality: getQualityLabel(reading.quality),
    bandwidth: formatBandwidth(reading.bandwidthEstimateKbps),
    latency: formatLatency(reading.latencyMs),
    offlineDuration: getOfflineDurationHuman(reading.offlineDurationMs),
    lastSync:
      reading.lastSyncAt !== null
        ? getOfflineDurationHuman(Date.now() - reading.lastSyncAt)
        : 'Never',
    reconnectAttempts: reading.reconnectAttempts,
  };
}
