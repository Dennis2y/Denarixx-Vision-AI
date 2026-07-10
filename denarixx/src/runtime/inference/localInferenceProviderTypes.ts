// ─── Local Inference Provider Types ──────────────────────────────────────────
// Defines the interface all local inference providers must implement.
//
// Contract:
//   - Providers in embedded-prototype mode NEVER return isSimulated: true.
//   - If inference is unavailable, providers return empty detections + explicit error.
//   - Providers never fabricate detections as a fallback.
//   - Real inference latency is always measured; it is never a mock value.

// ─── Detection Output ─────────────────────────────────────────────────────────

export interface InferenceDetection {
  className: string;
  confidence: number;
  boundingBox: {
    x: number;       // 0.0–1.0 normalized to frame width
    y: number;       // 0.0–1.0 normalized to frame height
    width: number;
    height: number;
  };
  source: 'onnx-local' | 'tflite-local' | 'mock-test';
  isSimulated: boolean;
}

// ─── Provider Status ──────────────────────────────────────────────────────────

export type LocalInferenceProviderStatus =
  | 'not-initialized'
  | 'loading'
  | 'ready'
  | 'runtime-unavailable'    // onnxruntime-node not installed or not supported in env
  | 'model-not-found'        // DENARIXX_LOCAL_MODEL_PATH missing or path does not exist
  | 'model-load-failed'      // model file exists but fails to parse/load
  | 'inference-error'        // model loaded but inference session threw
  | 'shutdown';

// ─── Frame Input ─────────────────────────────────────────────────────────────

export interface InferenceFrameInput {
  pixels: Uint8Array | null;   // RGB24 bytes (width * height * 3); null = no real frame data
  width: number;
  height: number;
  frameId: number;
  timestampMs: number;
}

// ─── Inference Result ─────────────────────────────────────────────────────────

export interface InferenceResult {
  detections: InferenceDetection[];
  inferenceLatencyMs: number;
  providerStatus: LocalInferenceProviderStatus;
  modelPath: string | null;
  error: string | null;
  framesProcessed: number;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface LocalInferenceProvider {
  readonly id: string;
  readonly isSimulated: boolean;

  initialize(modelPath: string): Promise<LocalInferenceProviderStatus>;
  runInference(frame: InferenceFrameInput): Promise<InferenceResult>;
  shutdown(): Promise<void>;
  getStatus(): LocalInferenceProviderStatus;
}

// ─── Model Input Specification ────────────────────────────────────────────────

export type ModelInputColorFormat = 'rgb' | 'bgr';

export interface ModelInputSpec {
  width: number;
  height: number;
  channels: 3;
  colorFormat: ModelInputColorFormat;
  normalized: boolean;   // true = 0.0–1.0; false = 0–255
  batchFirst: boolean;   // true = NCHW [1,3,H,W]; false = NHWC [1,H,W,3]
}

export const DEFAULT_MODEL_INPUT_SPEC: ModelInputSpec = {
  width: 640,
  height: 640,
  channels: 3,
  colorFormat: 'rgb',
  normalized: true,
  batchFirst: true,
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;
export const DEFAULT_NMS_IOU_THRESHOLD = 0.45;

// ─── COCO-80 Class List ───────────────────────────────────────────────────────
// Standard YOLOv8 class ordering.

export const COCO_CLASSES_80: readonly string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
] as const;
