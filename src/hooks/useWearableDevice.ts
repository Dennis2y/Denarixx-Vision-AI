'use client';

/**
 * useWearableDevice (V8)
 *
 * React hook wrapping WearableConnectionEngine + HardwareBridgeEngine.
 * Manages device discovery, connection lifecycle, heartbeats, and
 * I/O source routing for the Smart Glasses Integration Layer.
 *
 * Safety:
 *  - Emits a safetyMessage whenever a vision device disconnects during
 *    an active session so the session page can speak the warning.
 *  - Phone camera is always available as fallback.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { WearableConnectionEngine } from '@/engines/wearableConnectionEngine';
import { HardwareBridgeEngine } from '@/engines/hardwareBridgeEngine';
import { DeviceCapabilityEngine } from '@/engines/deviceCapabilityEngine';
import { HARDWARE_DEFAULTS } from '@/types/hardware';
import type {
  ConnectedDevice,
  HardwareIOConfig,
  CameraSource,
  AudioOutput,
  HapticOutput,
  BrowserCapabilities,
  DeviceDisconnectEvent,
} from '@/types/hardware';

// ─── Heartbeat interval ───────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 5000;

// ─── Module-level engine singletons ──────────────────────────────────────────
// (outside hook so they don't reset on re-render)

const connectionEngine = new WearableConnectionEngine();
const capabilityEngine = new DeviceCapabilityEngine();

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseWearableDeviceReturn {
  devices: ConnectedDevice[];
  ioConfig: HardwareIOConfig;
  browserCaps: BrowserCapabilities;
  lastDisconnectEvent: DeviceDisconnectEvent | null;
  /** Connect a device by id. Returns false if id unknown. */
  connectDevice: (id: string) => void;
  /** Disconnect a device by id. */
  disconnectDevice: (id: string) => void;
  /** Manually set camera source (returns false if device not connected) */
  setCameraSource: (source: CameraSource) => void;
  setAudioOutput: (output: AudioOutput) => void;
  setHapticOutput: (output: HapticOutput) => void;
  /** True while a connect() animation is running */
  connectingId: string | null;
  clearDisconnectEvent: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWearableDevice(sessionIsActive = false): UseWearableDeviceReturn {
  const [devices, setDevices] = useState<ConnectedDevice[]>(() =>
    connectionEngine.getAll()
  );
  const [ioConfig, setIoConfig] = useState<HardwareIOConfig>({
    cameraSource: 'simulation',
    audioOutput: 'phone_speaker',
    hapticOutput: 'phone_vibration',
  });
  const [browserCaps, setBrowserCaps] = useState<BrowserCapabilities>(() => ({
    bluetooth: false, webUSB: false, webRTC: false,
    webNFC: false, serialPort: false, vibration: false, battery: false,
  }));
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [lastDisconnectEvent, setLastDisconnectEvent] = useState<DeviceDisconnectEvent | null>(null);

  const bridgeRef = useRef(new HardwareBridgeEngine(HARDWARE_DEFAULTS));
  const sessionActiveRef = useRef(sessionIsActive);

  // Keep session active ref in sync
  useEffect(() => {
    sessionActiveRef.current = sessionIsActive;
  }, [sessionIsActive]);

  // ── Refresh UI from engine state ─────────────────────────────────────────

  const refreshDevices = useCallback(() => {
    const all = connectionEngine.getAll();
    setDevices(all);
    const connected = all.filter((d) => d.status === 'active' || d.status === 'connected');
    const newIO = bridgeRef.current.recomputeIO(connected);
    setIoConfig(newIO);
  }, []);

  // ── Initialise browser capabilities + phone camera ───────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBrowserCaps(capabilityEngine.detectBrowserCapabilities());
    // Phone camera is always "connected" as the baseline device
    connectionEngine.ensurePhoneCamera();
    refreshDevices();
  }, [refreshDevices]);

  // ── Heartbeat timer ───────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = connectionEngine.tickAllHeartbeats();
      if (updated.length > 0) {
        refreshDevices();
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshDevices]);

  // ── Connect ───────────────────────────────────────────────────────────────

  const connectDevice = useCallback((id: string) => {
    const pending = connectionEngine.beginConnect(id);
    if (!pending) return;
    setConnectingId(id);
    refreshDevices();

    setTimeout(() => {
      const result = connectionEngine.finaliseConnect(id);
      setConnectingId(null);
      if (result.success) {
        const connected = connectionEngine.getConnected();
        const newIO = bridgeRef.current.recomputeIO(connected);
        setIoConfig(newIO);
      }
      refreshDevices();
    }, WearableConnectionEngine.CONNECT_DELAY_MS);
  }, [refreshDevices]);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnectDevice = useCallback((id: string) => {
    const device = connectionEngine.get(id);
    if (!device) return;

    const remaining = connectionEngine.getConnected().filter((d) => d.id !== id);

    const event = connectionEngine.simulateDisconnect(
      id,
      'user_requested',
      sessionActiveRef.current,
      bridgeRef.current.getIOConfig().cameraSource !== 'simulation' ? 'phone' : null
    );

    if (event) {
      const { safetyMessage, newIOConfig } = bridgeRef.current.handleDisconnect(event, remaining);
      setIoConfig(newIOConfig);
      if (safetyMessage) {
        setLastDisconnectEvent({ ...event, safetyMessage });
      }
    }
    refreshDevices();
  }, [refreshDevices]);

  // ── I/O overrides ─────────────────────────────────────────────────────────

  const setCameraSource = useCallback((source: CameraSource) => {
    const connected = connectionEngine.getConnected();
    const ok = bridgeRef.current.setCameraSource(source, connected);
    if (ok) setIoConfig(bridgeRef.current.getIOConfig());
  }, []);

  const setAudioOutput = useCallback((output: AudioOutput) => {
    bridgeRef.current.setAudioOutput(output);
    setIoConfig(bridgeRef.current.getIOConfig());
  }, []);

  const setHapticOutput = useCallback((output: HapticOutput) => {
    bridgeRef.current.setHapticOutput(output);
    setIoConfig(bridgeRef.current.getIOConfig());
  }, []);

  const clearDisconnectEvent = useCallback(() => {
    setLastDisconnectEvent(null);
  }, []);

  return {
    devices,
    ioConfig,
    browserCaps,
    lastDisconnectEvent,
    connectDevice,
    disconnectDevice,
    setCameraSource,
    setAudioOutput,
    setHapticOutput,
    connectingId,
    clearDisconnectEvent,
  };
}
