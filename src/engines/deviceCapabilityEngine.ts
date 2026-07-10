/**
 * DeviceCapabilityEngine (V8)
 *
 * Two responsibilities:
 *  1. Detect which browser APIs are available (runtime, SSR-safe)
 *  2. Describe what each DeviceKind requires and can offer
 *
 * Pure engine — no async, no I/O. Safe in server and client contexts.
 */

import type { DeviceKind, BrowserCapabilities, CameraSource, AudioOutput, HapticOutput } from '@/types/hardware';

// ─── Browser API detection ────────────────────────────────────────────────────

export class DeviceCapabilityEngine {
  /**
   * Detect available browser APIs at runtime.
   * Returns all-false when called during SSR (typeof window === 'undefined').
   */
  detectBrowserCapabilities(): BrowserCapabilities {
    if (typeof window === 'undefined') {
      return {
        bluetooth: false,
        webUSB: false,
        webRTC: false,
        webNFC: false,
        serialPort: false,
        vibration: false,
        battery: false,
      };
    }
    return {
      bluetooth: 'bluetooth' in navigator,
      webUSB: 'usb' in navigator,
      webRTC: 'mediaDevices' in navigator,
      webNFC: 'NDEFReader' in window,
      serialPort: 'serial' in navigator,
      vibration: 'vibrate' in navigator,
      battery: 'getBattery' in navigator,
    };
  }

  /**
   * Human-readable summary of browser capabilities for the Devices page.
   */
  describeBrowserCapabilities(caps: BrowserCapabilities): string[] {
    const lines: string[] = [];
    if (caps.webRTC) lines.push('Camera & microphone access (WebRTC)');
    if (caps.bluetooth) lines.push('Bluetooth device pairing');
    if (caps.webUSB) lines.push('USB device access (WebUSB)');
    if (caps.serialPort) lines.push('Serial port access (Smart Cane)');
    if (caps.webNFC) lines.push('NFC device detection');
    if (caps.vibration) lines.push('Haptic vibration feedback');
    if (caps.battery) lines.push('Battery level monitoring');
    return lines;
  }

  // ── Device-kind requirements ───────────────────────────────────────────────

  /**
   * Which browser API is needed to connect a device of this kind?
   * Returns null for internal (phone) devices.
   */
  requiredAPI(kind: DeviceKind): keyof BrowserCapabilities | null {
    switch (kind) {
      case 'phone_camera':
      case 'phone_speaker':
      case 'phone_mic':
        return null; // always available
      case 'bluetooth_camera':
      case 'bone_conduction':
      case 'haptic_motor':
      case 'smart_cane':
        return 'bluetooth';
      case 'wifi_glasses':
      case 'denarixx_glasses':
        return 'webRTC';
      case 'usb_camera':
        return 'webUSB';
    }
  }

  /**
   * Can a device of this kind be connected given the current browser capabilities?
   */
  canConnect(kind: DeviceKind, caps: BrowserCapabilities): boolean {
    const req = this.requiredAPI(kind);
    if (req === null) return true; // internal
    return caps[req] === true;
  }

  /**
   * Why a connection attempt would fail (or null if it can proceed).
   */
  connectionBlockedReason(kind: DeviceKind, caps: BrowserCapabilities): string | null {
    const req = this.requiredAPI(kind);
    if (req === null) return null;
    if (caps[req]) return null;

    const humanNames: Record<keyof BrowserCapabilities, string> = {
      bluetooth: 'Web Bluetooth',
      webUSB: 'WebUSB',
      webRTC: 'WebRTC / getUserMedia',
      webNFC: 'Web NFC',
      serialPort: 'Web Serial',
      vibration: 'Vibration API',
      battery: 'Battery API',
    };
    return `Requires ${humanNames[req]}, which is not available in this browser.`;
  }

  // ── I/O source validation ─────────────────────────────────────────────────

  /**
   * Determine the best available camera source given active connections.
   * Priority: denarixx_glasses > wifi_glasses > bluetooth > usb > phone > simulation.
   */
  bestCameraSource(
    connectedKinds: DeviceKind[],
    fallbackToPhone: boolean
  ): CameraSource {
    if (connectedKinds.includes('denarixx_glasses')) return 'denarixx_glasses';
    if (connectedKinds.includes('wifi_glasses'))     return 'wifi_glasses';
    if (connectedKinds.includes('bluetooth_camera')) return 'bluetooth';
    if (connectedKinds.includes('usb_camera'))       return 'usb';
    if (fallbackToPhone || connectedKinds.includes('phone_camera')) return 'phone';
    return 'simulation';
  }

  /**
   * Determine the best available audio output given active connections.
   */
  bestAudioOutput(connectedKinds: DeviceKind[]): AudioOutput {
    if (connectedKinds.includes('bone_conduction')) return 'bone_conduction';
    if (connectedKinds.includes('denarixx_glasses')) return 'bone_conduction'; // glasses include BC
    return 'phone_speaker';
  }

  /**
   * Determine the best available haptic output given active connections.
   */
  bestHapticOutput(connectedKinds: DeviceKind[]): HapticOutput {
    if (connectedKinds.includes('smart_cane'))   return 'smart_cane';
    if (connectedKinds.includes('haptic_motor')) return 'wrist_haptic';
    return 'phone_vibration';
  }

  // ── Human-readable device descriptions ────────────────────────────────────

  /**
   * Get the setup instructions for connecting a device of this kind.
   */
  setupInstructions(kind: DeviceKind): string {
    switch (kind) {
      case 'phone_camera':
        return 'Tap "Enable" on the Session page to grant camera permission. No pairing required.';
      case 'bluetooth_camera':
        return 'Enable Bluetooth on your phone. Put the camera in pairing mode, then tap Connect.';
      case 'wifi_glasses':
        return 'Connect your phone and glasses to the same Wi-Fi network. Tap Connect to start WebRTC stream.';
      case 'usb_camera':
        return 'Connect the USB camera to your phone using a USB-C adapter. Browser will request WebUSB access.';
      case 'denarixx_glasses':
        return 'Power on your Denarixx Vision Glasses. They will appear automatically when in range.';
      case 'bone_conduction':
        return 'Enable Bluetooth and put the headset in pairing mode. Tap Connect.';
      case 'haptic_motor':
        return 'Enable Bluetooth and put the wristband in pairing mode. Tap Connect.';
      case 'smart_cane':
        return 'Enable Bluetooth on the cane (hold the button 3 s). Tap Connect. Cane firmware v2+ required.';
      default:
        return 'Follow device-specific pairing instructions.';
    }
  }
}
