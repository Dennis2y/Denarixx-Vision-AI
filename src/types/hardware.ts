/**
 * Hardware abstraction types (V8)
 *
 * Shared types for the Smart Glasses Integration Layer:
 * device descriptors, connection state, I/O routing, browser capabilities.
 */

// ─── Device taxonomy ──────────────────────────────────────────────────────────

export type DeviceKind =
  | 'phone_camera'        // Built-in phone camera (always available)
  | 'bluetooth_camera'    // External BT camera (helmet, glasses)
  | 'wifi_glasses'        // Wi-Fi streaming glasses (RTSP/WebRTC)
  | 'usb_camera'          // USB or WebUSB camera
  | 'denarixx_glasses'    // Future proprietary Denarixx Vision Glasses
  | 'bone_conduction'     // Bone-conduction audio headset
  | 'haptic_motor'        // Wrist or vest haptic controller
  | 'smart_cane'          // Smart cane with vibration + sensor feedback
  | 'phone_mic'           // Built-in phone microphone
  | 'phone_speaker';      // Built-in phone speaker

export type ConnectionProtocol =
  | 'internal'   // Part of the phone — no pairing needed
  | 'bluetooth'  // Web Bluetooth API
  | 'wifi'       // WebRTC / RTSP over local Wi-Fi
  | 'usb'        // WebUSB API
  | 'webrtc'     // WebRTC peer connection
  | 'serial';    // Web Serial API (e.g. smart cane)

export type DeviceStatus =
  | 'undiscovered'  // Not yet seen
  | 'discovered'    // Seen in scan, not paired
  | 'connecting'    // Pairing in progress
  | 'connected'     // Paired and idle
  | 'active'        // Actively providing data
  | 'disconnecting' // Graceful teardown
  | 'disconnected'  // Was connected, now offline
  | 'error';        // Unrecoverable failure

export type ConnectionHealth =
  | 'excellent'   // Signal > 80%
  | 'good'        // Signal 60-80%
  | 'weak'        // Signal 30-60%
  | 'unstable'    // Signal < 30% or packet loss
  | 'lost';       // No signal

// ─── I/O routing ─────────────────────────────────────────────────────────────

export type CameraSource =
  | 'phone'           // getUserMedia on the phone
  | 'bluetooth'       // Bluetooth camera stream
  | 'wifi_glasses'    // Wi-Fi glasses stream
  | 'usb'             // USB camera
  | 'denarixx_glasses'// Denarixx proprietary camera
  | 'simulation';     // Synthetic / no camera

export type AudioOutput =
  | 'phone_speaker'    // Default phone speaker
  | 'bone_conduction'  // Bone-conduction transducer
  | 'bluetooth_audio'  // BT headset or glasses speaker
  | 'earpiece';        // Phone earpiece (quieter)

export type HapticOutput =
  | 'phone_vibration'  // navigator.vibrate on the phone
  | 'wrist_haptic'     // Wrist band motor
  | 'smart_cane'       // Cane vibration feedback
  | 'none';            // Haptic disabled

// ─── Capability descriptors ───────────────────────────────────────────────────

export interface DeviceCapabilities {
  hasCamera: boolean;
  hasAudio: boolean;
  hasHaptic: boolean;
  hasBattery: boolean;
  hasIMU: boolean;
  hasGPS: boolean;
  maxResolution?: { width: number; height: number };
  /** Horizontal field of view in degrees */
  fovDegrees?: number;
  audioType?: 'speaker' | 'bone_conduction' | 'earpiece' | 'bluetooth';
  hapticType?: 'vibration' | 'motor' | 'tap';
}

// ─── Device descriptors ───────────────────────────────────────────────────────

/** Static device profile — what it IS */
export interface DeviceInfo {
  id: string;
  name: string;
  kind: DeviceKind;
  protocol: ConnectionProtocol;
  capabilities: DeviceCapabilities;
  /** True for all devices in simulation MVP */
  isSimulated: boolean;
  description: string;
  icon: string; // emoji for quick UI rendering
}

/** Runtime state — what it IS DOING right now */
export interface ConnectedDevice extends DeviceInfo {
  status: DeviceStatus;
  /** 0.0–1.0, null when not applicable */
  batteryLevel: number | null;
  /** 0.0–1.0 signal quality, null when unknown */
  signalStrength: number | null;
  health: ConnectionHealth;
  connectedAt: Date | null;
  lastHeartbeat: Date | null;
  errorMessage: string | null;
}

// ─── Active I/O configuration ─────────────────────────────────────────────────

export interface HardwareIOConfig {
  cameraSource: CameraSource;
  audioOutput: AudioOutput;
  hapticOutput: HapticOutput;
}

// ─── Browser capabilities ─────────────────────────────────────────────────────

export interface BrowserCapabilities {
  bluetooth: boolean;
  webUSB: boolean;
  webRTC: boolean;
  webNFC: boolean;
  serialPort: boolean;
  vibration: boolean;
  battery: boolean;
}

// ─── Hardware settings ────────────────────────────────────────────────────────

export interface HardwareSettings {
  preferredCameraSource: CameraSource;
  preferredAudioOutput: AudioOutput;
  preferredHapticOutput: HapticOutput;
  autoConnectOnStart: boolean;
  /** Fall back to phone camera if glasses disconnect */
  fallbackToPhoneCamera: boolean;
  /** Speak a warning when a vision device disconnects during session */
  warnOnDisconnect: boolean;
}

export const HARDWARE_DEFAULTS: HardwareSettings = {
  preferredCameraSource: 'simulation',
  preferredAudioOutput: 'phone_speaker',
  preferredHapticOutput: 'phone_vibration',
  autoConnectOnStart: false,
  fallbackToPhoneCamera: true,
  warnOnDisconnect: true,
};

// ─── Disconnect event ─────────────────────────────────────────────────────────

export type DisconnectReason =
  | 'signal_lost'
  | 'user_requested'
  | 'power_failure'
  | 'error'
  | 'timeout';

export interface DeviceDisconnectEvent {
  device: ConnectedDevice;
  reason: DisconnectReason;
  sessionWasActive: boolean;
  /** What camera source was auto-selected after disconnect (null = none) */
  fallbackCamera: CameraSource | null;
  /** Safety message to speak to the user */
  safetyMessage: string;
  timestamp: Date;
}

// ─── Connection result ────────────────────────────────────────────────────────

export interface ConnectionResult {
  success: boolean;
  device: ConnectedDevice;
  errorMessage: string | null;
}
