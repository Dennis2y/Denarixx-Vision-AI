/**
 * WearableConnectionEngine (V8)
 *
 * Manages the full lifecycle of wearable/external device connections:
 *   discovery → connect → active → disconnect → fallback
 *
 * Phase 8 is a SIMULATION layer — no real Bluetooth/USB calls are made.
 * The engine provides the contract that real hardware drivers will implement.
 *
 * Pure engine — no async, no I/O, no React. Safe inside refs.
 */

import type {
  DeviceInfo,
  ConnectedDevice,
  ConnectionResult,
  DeviceDisconnectEvent,
  DeviceStatus,
  ConnectionHealth,
  CameraSource,
  DisconnectReason,
} from '@/types/hardware';

// ─── Simulated device catalogue ───────────────────────────────────────────────

export const SIMULATED_DEVICES: DeviceInfo[] = [
  {
    id: 'phone-camera-internal',
    name: 'Phone Camera',
    kind: 'phone_camera',
    protocol: 'internal',
    isSimulated: false, // Always real
    description: 'Built-in phone camera accessed via getUserMedia.',
    icon: '📱',
    capabilities: {
      hasCamera: true,
      hasAudio: false,
      hasHaptic: true,
      hasBattery: true,
      hasIMU: true,
      hasGPS: true,
      maxResolution: { width: 1920, height: 1080 },
      fovDegrees: 75,
    },
  },
  {
    id: 'denarixx-glasses-v1',
    name: 'Denarixx Vision Glasses',
    kind: 'denarixx_glasses',
    protocol: 'wifi',
    isSimulated: true,
    description: 'Proprietary Denarixx Vision Glasses — wide-angle camera + bone-conduction audio.',
    icon: '🥽',
    capabilities: {
      hasCamera: true,
      hasAudio: true,
      hasHaptic: false,
      hasBattery: true,
      hasIMU: true,
      hasGPS: false,
      maxResolution: { width: 1280, height: 720 },
      fovDegrees: 110,
      audioType: 'bone_conduction',
    },
  },
  {
    id: 'bt-camera-ext-001',
    name: 'Bluetooth Camera Clip',
    kind: 'bluetooth_camera',
    protocol: 'bluetooth',
    isSimulated: true,
    description: 'External Bluetooth camera clip — attach to glasses frames or hat brim.',
    icon: '📷',
    capabilities: {
      hasCamera: true,
      hasAudio: false,
      hasHaptic: false,
      hasBattery: true,
      hasIMU: false,
      hasGPS: false,
      maxResolution: { width: 720, height: 480 },
      fovDegrees: 90,
    },
  },
  {
    id: 'wifi-glasses-001',
    name: 'Wi-Fi Streaming Glasses',
    kind: 'wifi_glasses',
    protocol: 'wifi',
    isSimulated: true,
    description: 'Third-party Wi-Fi camera glasses streaming via WebRTC.',
    icon: '👓',
    capabilities: {
      hasCamera: true,
      hasAudio: false,
      hasHaptic: false,
      hasBattery: true,
      hasIMU: true,
      hasGPS: false,
      maxResolution: { width: 1920, height: 1080 },
      fovDegrees: 95,
    },
  },
  {
    id: 'bone-conduction-001',
    name: 'Bone-Conduction Headset',
    kind: 'bone_conduction',
    protocol: 'bluetooth',
    isSimulated: true,
    description: 'Bone-conduction audio headset — open-ear awareness while hearing guidance.',
    icon: '🎧',
    capabilities: {
      hasCamera: false,
      hasAudio: true,
      hasHaptic: false,
      hasBattery: true,
      hasIMU: false,
      hasGPS: false,
      audioType: 'bone_conduction',
    },
  },
  {
    id: 'haptic-wrist-001',
    name: 'Haptic Wristband',
    kind: 'haptic_motor',
    protocol: 'bluetooth',
    isSimulated: true,
    description: 'Wearable wristband with directional haptic motors for navigation cues.',
    icon: '⌚',
    capabilities: {
      hasCamera: false,
      hasAudio: false,
      hasHaptic: true,
      hasBattery: true,
      hasIMU: true,
      hasGPS: false,
      hapticType: 'motor',
    },
  },
  {
    id: 'smart-cane-001',
    name: 'Smart Cane',
    kind: 'smart_cane',
    protocol: 'bluetooth',
    isSimulated: true,
    description: 'Sensor-equipped smart cane with vibration feedback and obstacle detection.',
    icon: '🦯',
    capabilities: {
      hasCamera: false,
      hasAudio: false,
      hasHaptic: true,
      hasBattery: true,
      hasIMU: true,
      hasGPS: false,
      hapticType: 'vibration',
    },
  },
];

// ─── Engine ───────────────────────────────────────────────────────────────────

/** Simulated connection delay in milliseconds */
const CONNECT_DELAY_MS = 1200;

function makeConnectedDevice(info: DeviceInfo, status: DeviceStatus = 'disconnected'): ConnectedDevice {
  return {
    ...info,
    status,
    batteryLevel: info.capabilities.hasBattery ? 0.85 : null,
    signalStrength: null,
    health: 'excellent',
    connectedAt: null,
    lastHeartbeat: null,
    errorMessage: null,
  };
}

function signalToHealth(signal: number): ConnectionHealth {
  if (signal >= 0.8) return 'excellent';
  if (signal >= 0.6) return 'good';
  if (signal >= 0.3) return 'weak';
  if (signal > 0)   return 'unstable';
  return 'lost';
}

export class WearableConnectionEngine {
  private devices: Map<string, ConnectedDevice> = new Map();

  constructor() {
    // Pre-populate registry with all simulated devices in disconnected state
    for (const info of SIMULATED_DEVICES) {
      this.devices.set(info.id, makeConnectedDevice(info));
    }
  }

  // ── Discovery ───────────────────────────────────────────────────────────────

  /**
   * Return all known devices (discovered + connected).
   * In a real implementation this would trigger a BT/Wi-Fi scan.
   */
  getAll(): ConnectedDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Return only connected or active devices.
   */
  getConnected(): ConnectedDevice[] {
    return this.getAll().filter(
      (d) => d.status === 'connected' || d.status === 'active'
    );
  }

  /**
   * Return devices by capability.
   */
  getByCapability(cap: 'hasCamera' | 'hasAudio' | 'hasHaptic'): ConnectedDevice[] {
    return this.getConnected().filter((d) => d.capabilities[cap]);
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────

  /**
   * Begin connecting to a device (synchronous in simulation — sets 'connecting').
   * Callers should call `finaliseConnect(id)` after CONNECT_DELAY_MS.
   */
  beginConnect(id: string): ConnectedDevice | null {
    const d = this.devices.get(id);
    if (!d) return null;
    const updated: ConnectedDevice = { ...d, status: 'connecting', errorMessage: null };
    this.devices.set(id, updated);
    return updated;
  }

  /**
   * Complete the connection (call after the simulated delay).
   */
  finaliseConnect(id: string): ConnectionResult {
    const d = this.devices.get(id);
    if (!d) {
      return {
        success: false,
        device: d ?? makeConnectedDevice(SIMULATED_DEVICES[0]),
        errorMessage: `Device ${id} not found`,
      };
    }

    const signal = d.protocol === 'internal' ? 1.0 : 0.75 + Math.random() * 0.2;
    const connected: ConnectedDevice = {
      ...d,
      status: 'active',
      signalStrength: signal,
      health: signalToHealth(signal),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      errorMessage: null,
      // Simulate battery drain from initial level
      batteryLevel: d.batteryLevel !== null ? Math.min(d.batteryLevel, 0.9) : null,
    };
    this.devices.set(id, connected);
    return { success: true, device: connected, errorMessage: null };
  }

  /**
   * Disconnect a device gracefully.
   */
  disconnect(id: string, reason: DisconnectReason = 'user_requested'): ConnectedDevice | null {
    const d = this.devices.get(id);
    if (!d) return null;
    const disconnected: ConnectedDevice = {
      ...d,
      status: 'disconnected',
      signalStrength: null,
      health: 'lost',
      connectedAt: null,
      lastHeartbeat: null,
      errorMessage: reason === 'error' ? 'Connection lost unexpectedly' : null,
    };
    this.devices.set(id, disconnected);
    return disconnected;
  }

  /**
   * Simulate a device disconnect event (e.g. battery dead, out of range).
   * Returns a DisconnectEvent for the session to act on.
   */
  simulateDisconnect(
    id: string,
    reason: DisconnectReason,
    sessionWasActive: boolean,
    fallbackCamera: CameraSource | null
  ): DeviceDisconnectEvent | null {
    const d = this.disconnect(id, reason);
    if (!d) return null;

    const isVisionDevice = d.capabilities.hasCamera;
    const safetyMessage = isVisionDevice && sessionWasActive
      ? 'Vision device disconnected. Please stop and check carefully.'
      : reason === 'signal_lost'
        ? `${d.name} signal lost.`
        : `${d.name} disconnected.`;

    return {
      device: d,
      reason,
      sessionWasActive,
      fallbackCamera,
      safetyMessage,
      timestamp: new Date(),
    };
  }

  // ── Health monitoring ───────────────────────────────────────────────────────

  /**
   * Simulate a heartbeat tick — slightly varies signal strength.
   * Returns updated device or null if device not connected.
   */
  heartbeat(id: string): ConnectedDevice | null {
    const d = this.devices.get(id);
    if (!d || (d.status !== 'active' && d.status !== 'connected')) return null;

    // Simulate minor signal fluctuation
    const baseSignal = d.signalStrength ?? 0.7;
    const jitter = (Math.random() - 0.5) * 0.08;
    const newSignal = Math.max(0.1, Math.min(1.0, baseSignal + jitter));

    // Simulate slow battery drain (0.1% per heartbeat)
    const newBattery = d.batteryLevel !== null
      ? Math.max(0, d.batteryLevel - 0.001)
      : null;

    const updated: ConnectedDevice = {
      ...d,
      signalStrength: newSignal,
      health: signalToHealth(newSignal),
      batteryLevel: newBattery,
      lastHeartbeat: new Date(),
    };
    this.devices.set(id, updated);
    return updated;
  }

  /**
   * Run heartbeats on all active devices and return updated list.
   */
  tickAllHeartbeats(): ConnectedDevice[] {
    const updated: ConnectedDevice[] = [];
    for (const d of this.devices.values()) {
      if (d.status === 'active' || d.status === 'connected') {
        const ticked = this.heartbeat(d.id);
        if (ticked) updated.push(ticked);
      }
    }
    return updated;
  }

  /**
   * Get a device by id.
   */
  get(id: string): ConnectedDevice | undefined {
    return this.devices.get(id);
  }

  /**
   * Simulate the phone camera as always-present and auto-active.
   */
  ensurePhoneCamera(): ConnectedDevice {
    const phone = this.devices.get('phone-camera-internal');
    if (!phone) throw new Error('Phone camera device missing from registry');
    if (phone.status !== 'active') {
      const result = this.finaliseConnect('phone-camera-internal');
      return result.device;
    }
    return phone;
  }

  /** How long (ms) a simulated connect takes */
  static get CONNECT_DELAY_MS() { return CONNECT_DELAY_MS; }
}
