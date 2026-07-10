// ─── Network Driver ───────────────────────────────────────────────────────────
// Linux network state driver — reads real connectivity status from sysfs/procfs.
//
// Real implementation (Linux — no native binding required):
//   Interface state: /sys/class/net/<iface>/operstate  → 'up' | 'down' | 'unknown'
//   Link speed:      /sys/class/net/<iface>/speed      → Mbps integer
//   WLAN signal:     /proc/net/wireless                → signal level in dBm
//   Default route:   /proc/net/route                   → check for non-zero gateway
//
// All reads use fs.readFileSync — no native binding required.
// This driver CAN be partially implemented now.
//
// Connection quality rules:
//   operstate !== 'up'       → offline
//   RSSI < -80 dBm           → weak
//   RSSI >= -80 dBm          → good
//   No WLAN info available   → assume good (wired or unknown)

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkDriverStatus = 'not-initialized' | 'online-good' | 'online-weak' | 'offline' | 'unavailable' | 'closed';
export type NetworkQuality = 'good' | 'weak' | 'offline';

export interface NetworkDriverConfig {
  primaryInterface: string;   // e.g. 'wlan0', 'eth0', 'usb0'
  fallbackInterface?: string; // e.g. 'eth0' if wlan0 is primary
  weakSignalThresholdDbm: number; // e.g. -80
}

export interface NetworkReading {
  isOnline: boolean;
  quality: NetworkQuality;
  interfaceName: string;
  rssiDbm: number | null;        // null if not WiFi or not readable
  operationalState: string;      // raw /sys/class/net/<iface>/operstate value
  hasDefaultRoute: boolean;
  timestampMs: number;
  isSimulated: false;
}

export interface NetworkDriverState {
  config: NetworkDriverConfig;
  status: NetworkDriverStatus;
  readCount: number;
  errorCount: number;
  lastErrorMessage: string | null;
  sysfsAvailable: boolean;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createNetworkDriverState(config: NetworkDriverConfig): NetworkDriverState {
  const sysfsAvailable = fs.existsSync('/sys/class/net');
  return {
    config, status: 'not-initialized',
    readCount: 0, errorCount: 0, lastErrorMessage: null,
    sysfsAvailable,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeNetworkDriver(
  state: NetworkDriverState,
): { state: NetworkDriverState; error: string | null } {
  if (!state.sysfsAvailable) {
    const error = `Network sysfs not available. Not running on Linux.`;
    return { state: { ...state, status: 'unavailable', lastErrorMessage: error }, error };
  }
  return { state: { ...state, status: 'offline' }, error: null };
}

// ─── Read Network State ───────────────────────────────────────────────────────
// Reads real sysfs values on Linux. Returns error on non-Linux.

export function readNetworkState(
  state: NetworkDriverState,
): { state: NetworkDriverState; reading: NetworkReading | null; error: string | null } {
  if (!state.sysfsAvailable) {
    return { state, reading: null, error: 'Network sysfs unavailable.' };
  }

  const nowMs = Date.now();
  const iface = state.config.primaryInterface;
  const opstatePath = `/sys/class/net/${iface}/operstate`;

  let operationalState = 'unknown';
  if (fs.existsSync(opstatePath)) {
    try { operationalState = fs.readFileSync(opstatePath, 'utf8').trim(); } catch { /* ignore */ }
  }

  const isOnline = operationalState === 'up';

  // Read RSSI from /proc/net/wireless if available
  let rssiDbm: number | null = null;
  const wirelessPath = '/proc/net/wireless';
  if (fs.existsSync(wirelessPath)) {
    try {
      const wirelessData = fs.readFileSync(wirelessPath, 'utf8');
      const lines = wirelessData.split('\n');
      const ifaceLine = lines.find(l => l.includes(iface));
      if (ifaceLine) {
        const parts = ifaceLine.trim().split(/\s+/);
        if (parts.length >= 4) {
          const rawRssi = parseFloat(parts[3].replace('.', ''));
          if (!isNaN(rawRssi)) rssiDbm = rawRssi;
        }
      }
    } catch { /* ignore */ }
  }

  // Check default route
  let hasDefaultRoute = false;
  const routePath = '/proc/net/route';
  if (fs.existsSync(routePath)) {
    try {
      const routeData = fs.readFileSync(routePath, 'utf8');
      hasDefaultRoute = routeData.split('\n').some(line => {
        const cols = line.trim().split(/\s+/);
        return cols[1] === '00000000' && cols[7] !== '00000000';
      });
    } catch { /* ignore */ }
  }

  const quality: NetworkQuality = !isOnline ? 'offline' :
    rssiDbm !== null && rssiDbm < state.config.weakSignalThresholdDbm ? 'weak' : 'good';

  const reading: NetworkReading = {
    isOnline,
    quality,
    interfaceName: iface,
    rssiDbm,
    operationalState,
    hasDefaultRoute,
    timestampMs: nowMs,
    isSimulated: false,
  };

  const newStatus: NetworkDriverStatus = !isOnline ? 'offline' :
    quality === 'weak' ? 'online-weak' : 'online-good';

  return {
    state: { ...state, status: newStatus, readCount: state.readCount + 1 },
    reading,
    error: null,
  };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getNetworkDriverHealth(state: NetworkDriverState): NetworkDriverStatus {
  return state.status;
}

export function shutdownNetworkDriver(state: NetworkDriverState): NetworkDriverState {
  return { ...state, status: 'closed' };
}
