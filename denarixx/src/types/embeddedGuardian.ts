// ─── Shared Embedded Guardian Contract ───────────────────────────────────────
// Common input/output types for the embedded Guardian orchestration pipeline.
// Both the browser session (useVisionSession.ts) and the embedded runtime
// (embeddedVisionRuntime.ts) must produce and consume these shapes.
//
// Safety invariant: any EmbeddedGuardianInput where a detection has
// isSimulated === true MUST be rejected by embeddedGuardianOrchestrator
// when the adapter mode is 'embedded-prototype'.
//
// Navigation safety rule: never say "safe to cross". Use cautious language:
//   "The crossing appears clear, but please check carefully."

import type { RiskLevel } from './cognitive';

// ─── Detection as it arrives from ONNX inference ─────────────────────────────

export interface EmbeddedInferenceDetection {
  className: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  isSimulated: boolean;
  trackingId?: string;
}

// ─── Sensor context ───────────────────────────────────────────────────────────
// All fields optional. When a sensor is unavailable, omit the field or set
// the corresponding `*Available` flag to false. Never fabricate sensor values.

export interface EmbeddedSensorContext {
  imuMovementState?: 'stationary' | 'walking' | 'running' | 'unknown';
  headingDegrees?: number;
  gnssAvailable?: boolean;
  cameraDirection?: 'forward' | 'left' | 'right' | 'unknown';
  userSpeedMs?: number;
}

// ─── Navigation context ───────────────────────────────────────────────────────

export interface EmbeddedNavigationContext {
  routeActive?: boolean;
  crossingActive?: boolean;
  landmarkNearby?: string;
  routeSegment?: string;
}

// ─── Device health context ────────────────────────────────────────────────────

export interface EmbeddedDeviceHealth {
  batteryPct?: number;
  temperatureC?: number;
}

// ─── Full Guardian input ──────────────────────────────────────────────────────

export interface EmbeddedGuardianInput {
  detections: EmbeddedInferenceDetection[];
  frameTimestampMs: number;
  providerSource: 'onnx-local' | 'simulation-test';
  sensors?: EmbeddedSensorContext;
  navigation?: EmbeddedNavigationContext;
  deviceHealth?: EmbeddedDeviceHealth;
  repeatRequested?: boolean;
}

// ─── Full Guardian output ─────────────────────────────────────────────────────

export interface EmbeddedGuardianOutput {
  riskLevel: RiskLevel;
  recommendedAction: string;
  message: string | null;
  shouldSpeak: boolean;
  shouldInterrupt: boolean;
  hapticPattern: string | null;
  confidence: number;
  uncertaintyStatement: string | null;
  decisionReason: string;
  cooldownKey: string;
}
