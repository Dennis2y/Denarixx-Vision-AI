// ─── V12 Real-Time AI Vision Types ──────────────────────────────────────────
// Separate from vision.ts (V4) to avoid breaking existing providers.

// ─── Object Labels ──────────────────────────────────────────────────────────

export type ObjectLabel =
  | 'person'
  | 'chair'
  | 'table'
  | 'car'
  | 'bike'
  | 'stairs'
  | 'door'
  | 'traffic_light'
  | 'crosswalk'
  | 'dog'
  | 'bag'
  | 'tree'
  | 'sign'
  | 'shopping_cart'
  | 'wheelchair'
  | 'construction_barrier';

export const ALL_OBJECT_LABELS: ObjectLabel[] = [
  'person', 'chair', 'table', 'car', 'bike', 'stairs', 'door',
  'traffic_light', 'crosswalk', 'dog', 'bag', 'tree', 'sign',
  'shopping_cart', 'wheelchair', 'construction_barrier',
];

// ─── Depth & Priority ───────────────────────────────────────────────────────

export type DepthEstimate = 'collision' | 'near' | 'walking_distance' | 'medium' | 'far';

export type ObjectPriority = 'critical' | 'high' | 'medium' | 'low' | 'ignore';

export const PRIORITY_ORDER: ObjectPriority[] = [
  'critical', 'high', 'medium', 'low', 'ignore',
];

// ─── Bounding Box ────────────────────────────────────────────────────────────

export interface BoundingBox {
  /** Normalized 0–1 relative to frame width */
  x: number;
  /** Normalized 0–1 relative to frame height */
  y: number;
  width: number;
  height: number;
}

// ─── Object Velocity ─────────────────────────────────────────────────────────

export interface ObjectVelocity {
  /** Horizontal movement per frame (normalized, positive = right) */
  dx: number;
  /** Vertical movement per frame (normalized, positive = down) */
  dy: number;
  speed: 'fast' | 'moderate' | 'slow' | 'stationary';
}

// ─── Detected Object ─────────────────────────────────────────────────────────

export interface DetectedObject {
  /** Tracking ID — stable across frames */
  trackId: string;
  label: ObjectLabel;
  confidence: number;
  distance: DepthEstimate;
  priority: ObjectPriority;
  boundingBox: BoundingBox;
  velocity: ObjectVelocity | null;
  /** Unix ms when first detected */
  firstSeen: number;
  /** Unix ms of most recent frame */
  lastSeen: number;
  /** Number of consecutive frames seen */
  frameCount: number;
  /** Seconds until potential collision, null if not applicable */
  timeToCollision: number | null;
}

// ─── Tracked Object (internal tracker state) ─────────────────────────────────

export interface TrackedObject {
  trackId: string;
  label: ObjectLabel;
  history: Array<{ timestamp: number; boundingBox: BoundingBox; confidence: number }>;
  velocity: ObjectVelocity | null;
  predictedPosition: BoundingBox | null;
  lostFrames: number;
  distance: DepthEstimate;
  priority: ObjectPriority;
  firstSeen: number;
}

export interface TrackerState {
  tracks: Map<string, TrackedObject>;
  nextTrackId: number;
  frameTimestamp: number;
}

// ─── Scene Understanding ─────────────────────────────────────────────────────

export type SceneType =
  | 'indoor'
  | 'office'
  | 'restaurant'
  | 'supermarket'
  | 'park'
  | 'street'
  | 'station'
  | 'airport'
  | 'shopping_mall'
  | 'corridor'
  | 'room'
  | 'unknown';

export type CrowdingLevel = 'empty' | 'sparse' | 'moderate' | 'crowded';
export type LightingLevel = 'bright' | 'normal' | 'dim' | 'dark';
export type MovementLevel = 'static' | 'low' | 'moderate' | 'high';

export interface SceneUnderstanding {
  scene: SceneType;
  confidence: number;
  lighting: LightingLevel;
  crowding: CrowdingLevel;
  movement: MovementLevel;
}

// ─── Perception Frame ────────────────────────────────────────────────────────

export interface PerceptionFrame {
  frameId: string;
  timestamp: number;
  objects: DetectedObject[];
  scene: SceneUnderstanding;
  spokenGuidance: string | null;
  shouldSpeak: boolean;
  frameLatencyMs: number;
  inferenceLatencyMs: number;
  fps: number;
  provider: InferenceProvider;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export type InferenceProvider =
  | 'simulation'
  | 'openai'
  | 'gemini'
  | 'onnx'
  | 'yolo'
  | 'rtdetr'
  | 'sam';

export type BatteryMode = 'performance' | 'balanced' | 'power_save';

export interface PipelineConfig {
  provider: InferenceProvider;
  targetFps: number;
  maxInferenceMs: number;
  adaptiveFps: boolean;
  batteryMode: BatteryMode;
  priorityThreshold: ObjectPriority;
  gpuAcceleration: boolean;
  privacy: PipelinePrivacy;
}

export interface PipelinePrivacy {
  readonly noCloudStorage: true;
  readonly noRecording: true;
  readonly noFaceRecognition: true;
  readonly noIdentityRecognition: true;
}

export const PIPELINE_PRIVACY: PipelinePrivacy = {
  noCloudStorage: true,
  noRecording: true,
  noFaceRecognition: true,
  noIdentityRecognition: true,
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  provider: 'simulation',
  targetFps: 5,
  maxInferenceMs: 500,
  adaptiveFps: true,
  batteryMode: 'balanced',
  priorityThreshold: 'low',
  gpuAcceleration: false,
  privacy: PIPELINE_PRIVACY,
};

// ─── Model Descriptor ────────────────────────────────────────────────────────

export interface ModelDescriptor {
  id: string;
  provider: InferenceProvider;
  name: string;
  description: string;
  inputSize: [number, number];
  requiresCloud: boolean;
  supportsGPU: boolean;
  avgInferenceMs: number;
  labels: ObjectLabel[];
  available: boolean;
}

// ─── Pipeline Metrics ────────────────────────────────────────────────────────

export interface PipelineMetrics {
  averageFps: number;
  averageFrameLatencyMs: number;
  averageInferenceLatencyMs: number;
  framesProcessed: number;
  framesSkipped: number;
  objectsDetectedTotal: number;
  speechEventsTotal: number;
  droppedFrames: number;
}

export const EMPTY_METRICS: PipelineMetrics = {
  averageFps: 0,
  averageFrameLatencyMs: 0,
  averageInferenceLatencyMs: 0,
  framesProcessed: 0,
  framesSkipped: 0,
  objectsDetectedTotal: 0,
  speechEventsTotal: 0,
  droppedFrames: 0,
};
