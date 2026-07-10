/**
 * HardwareBridgeEngine (V8)
 *
 * Routes camera, audio, and haptic I/O between the session pipeline and
 * whatever physical devices are currently connected.
 *
 * Responsibilities:
 *  - Select the active camera source based on connected devices + settings
 *  - Select the active audio output and haptic output
 *  - Handle device disconnect → apply fallback + emit safety message
 *  - Enforce safety rules: no video storage, no face recognition
 *
 * Pure engine — no async, no I/O. Safe inside refs.
 */

import type {
  ConnectedDevice,
  HardwareIOConfig,
  CameraSource,
  AudioOutput,
  HapticOutput,
  HardwareSettings,
  DeviceDisconnectEvent,
} from '@/types/hardware';
import { DeviceCapabilityEngine } from './deviceCapabilityEngine';

const capabilityEngine = new DeviceCapabilityEngine();

// ─── Safety constraints ───────────────────────────────────────────────────────

export const SAFETY_RULES = {
  /** Video frames MUST NOT be persisted anywhere */
  noVideoStorage: true,
  /** Face recognition MUST NOT be enabled */
  noFaceRecognition: true,
  /** Session must warn user on vision device disconnect */
  warnOnVisionDisconnect: true,
  /** Phone camera is always the fallback if configured */
  phoneCameraFallback: true,
} as const;

// ─── Engine ───────────────────────────────────────────────────────────────────

export class HardwareBridgeEngine {
  private settings: HardwareSettings;
  private ioConfig: HardwareIOConfig;

  constructor(settings: HardwareSettings) {
    this.settings = settings;
    this.ioConfig = {
      cameraSource: settings.preferredCameraSource,
      audioOutput: settings.preferredAudioOutput,
      hapticOutput: settings.preferredHapticOutput,
    };
  }

  // ── I/O routing ────────────────────────────────────────────────────────────

  /**
   * Recompute the optimal I/O configuration from the currently connected devices.
   * Call this any time the device list changes.
   */
  recomputeIO(connected: ConnectedDevice[]): HardwareIOConfig {
    const kinds = connected
      .filter((d) => d.status === 'active' || d.status === 'connected')
      .map((d) => d.kind);

    const camera = capabilityEngine.bestCameraSource(
      kinds,
      this.settings.fallbackToPhoneCamera
    );
    const audio = capabilityEngine.bestAudioOutput(kinds);
    const haptic = capabilityEngine.bestHapticOutput(kinds);

    this.ioConfig = { cameraSource: camera, audioOutput: audio, hapticOutput: haptic };
    return this.ioConfig;
  }

  /**
   * Manually override the camera source (user selection).
   */
  setCameraSource(source: CameraSource, connected: ConnectedDevice[]): boolean {
    // Validate the requested source is actually connected
    const cameraDevices: Partial<Record<CameraSource, boolean>> = {
      phone: connected.some((d) => d.kind === 'phone_camera' && d.status === 'active'),
      bluetooth: connected.some((d) => d.kind === 'bluetooth_camera' && d.status === 'active'),
      wifi_glasses: connected.some((d) => d.kind === 'wifi_glasses' && d.status === 'active'),
      usb: connected.some((d) => d.kind === 'usb_camera' && d.status === 'active'),
      denarixx_glasses: connected.some((d) => d.kind === 'denarixx_glasses' && d.status === 'active'),
      simulation: true, // always available
    };

    if (!cameraDevices[source]) return false;
    this.ioConfig = { ...this.ioConfig, cameraSource: source };
    return true;
  }

  /**
   * Manually override the audio output.
   */
  setAudioOutput(output: AudioOutput): void {
    this.ioConfig = { ...this.ioConfig, audioOutput: output };
  }

  /**
   * Manually override the haptic output.
   */
  setHapticOutput(output: HapticOutput): void {
    this.ioConfig = { ...this.ioConfig, hapticOutput: output };
  }

  /**
   * Get the current I/O configuration.
   */
  getIOConfig(): HardwareIOConfig { return { ...this.ioConfig }; }

  // ── Disconnect handling ────────────────────────────────────────────────────

  /**
   * Handle a device disconnect event: update I/O routing, select fallback,
   * and return the safety message if a vision device was lost.
   *
   * Safety rule: if glasses disconnect during an active session → immediate warning.
   */
  handleDisconnect(
    event: DeviceDisconnectEvent,
    remaining: ConnectedDevice[]
  ): { safetyMessage: string | null; newIOConfig: HardwareIOConfig } {
    const isVisionDevice = event.device.capabilities.hasCamera;

    // Recompute I/O from remaining devices
    const newConfig = this.recomputeIO(remaining);

    let safetyMessage: string | null = null;

    if (isVisionDevice && event.sessionWasActive && this.settings.warnOnDisconnect) {
      safetyMessage = event.safetyMessage; // "Vision device disconnected. Please stop and check carefully."
    } else if (event.device.capabilities.hasAudio && event.sessionWasActive) {
      safetyMessage = `${event.device.name} disconnected. Switching to phone speaker.`;
    }

    return { safetyMessage, newIOConfig: newConfig };
  }

  // ── Source descriptions ────────────────────────────────────────────────────

  /** Human-readable label for a camera source */
  describeCameraSource(source: CameraSource): string {
    const labels: Record<CameraSource, string> = {
      phone:             'Phone Camera',
      bluetooth:         'Bluetooth Camera',
      wifi_glasses:      'Wi-Fi Glasses',
      usb:               'USB Camera',
      denarixx_glasses:  'Denarixx Vision Glasses',
      simulation:        'Simulation (no camera)',
    };
    return labels[source];
  }

  /** Human-readable label for an audio output */
  describeAudioOutput(output: AudioOutput): string {
    const labels: Record<AudioOutput, string> = {
      phone_speaker:    'Phone Speaker',
      bone_conduction:  'Bone-Conduction Headset',
      bluetooth_audio:  'Bluetooth Audio',
      earpiece:         'Phone Earpiece',
    };
    return labels[output];
  }

  /** Human-readable label for a haptic output */
  describeHapticOutput(output: HapticOutput): string {
    const labels: Record<HapticOutput, string> = {
      phone_vibration: 'Phone Vibration',
      wrist_haptic:    'Haptic Wristband',
      smart_cane:      'Smart Cane',
      none:            'Haptic Disabled',
    };
    return labels[output];
  }

  // ── Camera source → session integration ───────────────────────────────────

  /**
   * Map the current camera source to the session's data-source string.
   * 'phone' → 'camera', anything else → 'simulation' for Phase 8
   * (real streams not yet wired).
   */
  sessionSource(cameraSource: CameraSource): 'camera' | 'simulation' {
    return cameraSource === 'phone' ? 'camera' : 'simulation';
  }

  updateSettings(patch: Partial<HardwareSettings>): void {
    this.settings = { ...this.settings, ...patch };
  }
}
