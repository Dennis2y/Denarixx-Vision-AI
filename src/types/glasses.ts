// ─── V14 Multi-Camera Smart Glasses Types ─────────────────────────────────────
// Separate from src/types/hardware.ts (V8 CameraSource) to avoid conflicts.

// ─── Camera Sources & Positions ───────────────────────────────────────────────

export type GlassesCameraPosition =
  | 'front'      // Primary forward-facing camera
  | 'left'       // Left peripheral camera
  | 'right'      // Right peripheral camera
  | 'external';  // External wearable clip-on camera

export type CameraHealthStatus =
  | 'active'    // Streaming normally
  | 'degraded'  // Low FPS or high latency
  | 'failed'    // Error / crashed
  | 'offline'   // Not connected
  | 'standby';  // Connected but idle

// ─── Field of View ────────────────────────────────────────────────────────────

export type FovZone =
  | 'center'    // Within 30° of forward heading
  | 'left'      // 30–100° left
  | 'right'     // 30–100° right
  | 'overhead'  // Above horizon
  | 'below';    // Below horizon

// ─── Camera Feed ──────────────────────────────────────────────────────────────

export interface CameraFeed {
  position: GlassesCameraPosition;
  healthStatus: CameraHealthStatus;
  latencyMs: number;
  frameQuality: number;    // 0–1, 1 = perfect
  fps: number;
  connected: boolean;
  lastFrameAt: number;     // epoch ms
  errorMessage: string | null;
}

// ─── Glasses State ────────────────────────────────────────────────────────────

export type GlassesConnectionHealth = 'excellent' | 'good' | 'degraded' | 'lost';

export interface GlassesState {
  deviceId: string;
  deviceName: string;
  feeds: CameraFeed[];
  batteryPct: number;           // 0–100
  connectionHealth: GlassesConnectionHealth;
  activeSource: GlassesCameraPosition | 'phone' | 'none';
  fallbackActive: boolean;
  fallbackReason: string | null;
  connectedAt: number | null;
  privacy: CameraPrivacy;
}

// ─── Fused Detection ──────────────────────────────────────────────────────────

export type DetectionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface FusedDetection {
  label: string;
  confidence: number;
  fovZone: FovZone;
  cameraSource: GlassesCameraPosition | 'phone';
  priority: DetectionPriority;
  estimatedDistanceM: number | null;
}

// ─── Fused Frame ──────────────────────────────────────────────────────────────

export interface FusedFrame {
  timestamp: number;
  detections: FusedDetection[];
  primarySource: GlassesCameraPosition | 'phone' | 'none';
  fusedCameraCount: number;
  fieldOfViewCoverage: FovZone[];
  hasPeripheralThreat: boolean;
  guidanceText: string | null;
}

// ─── Wearable Sensor Frame ────────────────────────────────────────────────────

export interface WearableSensorFrame {
  timestamp: number;
  accelerometer: { x: number; y: number; z: number } | null;
  gyroscope: { x: number; y: number; z: number } | null;
  magnetometer: { heading: number } | null;
  batteryPct: number;
  temperatureCelsius: number | null;
  isCharging: boolean;
}

export type WearableMotionState = 'stationary' | 'walking' | 'running' | 'unknown';
export type ThermalState = 'normal' | 'warm' | 'hot';

// ─── Multi-Camera Config ──────────────────────────────────────────────────────

export interface MultiCameraConfig {
  maxActiveCameras: number;
  deduplicationThreshold: number;  // confidence diff to treat as same object
  fallbackToPhoneOnAllFail: boolean;
  peripheralWarningsEnabled: boolean;
  fusionStrategy: 'highest_confidence' | 'union' | 'center_priority';
}

export const DEFAULT_MULTICAMERA_CONFIG: MultiCameraConfig = {
  maxActiveCameras: 4,
  deduplicationThreshold: 0.15,
  fallbackToPhoneOnAllFail: true,
  peripheralWarningsEnabled: true,
  fusionStrategy: 'center_priority',
};

// ─── Privacy ──────────────────────────────────────────────────────────────────

export interface CameraPrivacy {
  readonly noVideoStorage: true;
  readonly noFaceRecognition: true;
  readonly noBystander: true;
}

export const CAMERA_PRIVACY: CameraPrivacy = {
  noVideoStorage: true,
  noFaceRecognition: true,
  noBystander: true,
};

// ─── Fallback messages ────────────────────────────────────────────────────────

export const VISION_UNAVAILABLE_MESSAGE =
  'Vision input unavailable. Please stop and check carefully.';
export const CAMERA_DEGRADED_MESSAGE =
  'Camera quality has dropped. Guidance may be less accurate. Check your surroundings carefully.';
export const PHONE_FALLBACK_MESSAGE =
  'Glasses camera disconnected. Switched to phone camera.';
