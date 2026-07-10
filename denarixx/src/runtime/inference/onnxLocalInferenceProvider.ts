// ─── ONNX Runtime Local Inference Provider ────────────────────────────────────
// Real embedded inference using onnxruntime-node.
//
// Requirements (physical compute module):
//   Node.js 18+ | onnxruntime-node installed | valid ONNX model at model path
//
// Graceful degradation:
//   - If onnxruntime-node is not installed → status 'runtime-unavailable', empty detections + error
//   - If model file missing → status 'model-not-found', empty detections + error
//   - If model fails to load → status 'model-load-failed', empty detections + error
//   - If inference throws → status 'inference-error', empty detections + error
//   In ALL error cases: no fabricated detections are returned.
//
// Model format: YOLOv8 ONNX export (or compatible)
//   Input:  [1, 3, H, W] float32 RGB normalized 0.0–1.0 (NCHW)
//   Output: [1, 84, N]   float32 (4 box coords + 80 class scores per detection)
//
// Preprocessing:
//   1. Resize RGB24 bytes → model input dimensions (bilinear)
//   2. Normalize uint8 → float32 0.0–1.0
//   3. Transpose HWC → NCHW [1, 3, H, W]
//
// Uses dynamic import so this file type-checks even without onnxruntime-node.

import * as fs from 'fs';
import * as path from 'path';
import type {
  LocalInferenceProvider,
  LocalInferenceProviderStatus,
  InferenceFrameInput,
  InferenceResult,
  InferenceDetection,
} from './localInferenceProviderTypes';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_NMS_IOU_THRESHOLD,
  DEFAULT_MODEL_INPUT_SPEC,
  COCO_CLASSES_80,
} from './localInferenceProviderTypes';

// ─── ONNX Runtime Dynamic Import ─────────────────────────────────────────────

type OrtSession = {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  release(): Promise<void>;
};
type OrtTensor = {
  data: Float32Array | Int32Array | Uint8Array;
  dims: readonly number[];
  type: string;
};
type OrtModule = {
  InferenceSession: {
    create(p: string, opts?: Record<string, unknown>): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => OrtTensor;
};

async function tryLoadOrt(): Promise<OrtModule | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await import('onnxruntime-node')) as any;
  } catch {
    return null;
  }
}

// ─── Bilinear Resize + Normalize ─────────────────────────────────────────────

function resizeBilinear(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const dst = new Float32Array(dstW * dstH * 3);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * xRatio;
      const sy = y * yRatio;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const p00 = src[(y0 * srcW + x0) * 3 + c];
        const p10 = src[(y0 * srcW + x1) * 3 + c];
        const p01 = src[(y1 * srcW + x0) * 3 + c];
        const p11 = src[(y1 * srcW + x1) * 3 + c];
        dst[(y * dstW + x) * 3 + c] =
          (p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) +
           p01 * (1 - fx) * fy       + p11 * fx * fy) / 255.0;
      }
    }
  }
  return dst;
}

function transposeHWCtoNCHW(
  hwc: Float32Array,
  h: number,
  w: number,
): Float32Array {
  const nchw = new Float32Array(3 * h * w);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        nchw[c * h * w + y * w + x] = hwc[(y * w + x) * 3 + c];
      }
    }
  }
  return nchw;
}

// ─── Non-Maximum Suppression ──────────────────────────────────────────────────

function boxIOU(a: InferenceDetection, b: InferenceDetection): number {
  const ax2 = a.boundingBox.x + a.boundingBox.width;
  const ay2 = a.boundingBox.y + a.boundingBox.height;
  const bx2 = b.boundingBox.x + b.boundingBox.width;
  const by2 = b.boundingBox.y + b.boundingBox.height;
  const ix1 = Math.max(a.boundingBox.x, b.boundingBox.x);
  const iy1 = Math.max(a.boundingBox.y, b.boundingBox.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = a.boundingBox.width * a.boundingBox.height
    + b.boundingBox.width * b.boundingBox.height - inter;
  return union <= 0 ? 0 : inter / union;
}

function applyNMS(
  dets: InferenceDetection[],
  iouThreshold: number,
): InferenceDetection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const kept: InferenceDetection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!suppressed.has(j) && boxIOU(sorted[i], sorted[j]) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }
  return kept;
}

// ─── YOLOv8 Output Decoding ───────────────────────────────────────────────────
// YOLOv8 ONNX export shape: [1, 84, N] where 84 = 4 box + 80 class scores.
// Box coords are cx,cy,w,h in model pixel coordinates (not normalized).

function decodeYolov8(
  data: Float32Array,
  dims: readonly number[],
  modelW: number,
  modelH: number,
  confThreshold: number,
): InferenceDetection[] {
  const dets: InferenceDetection[] = [];
  let numDets: number;
  let numClasses: number;
  let transposed: boolean;

  if (dims.length === 3) {
    if (dims[1] === 84) {
      numDets = dims[2]; numClasses = 80; transposed = false;
    } else if (dims[2] >= 5) {
      numDets = dims[1]; numClasses = dims[2] - 4; transposed = true;
    } else { return []; }
  } else if (dims.length === 2 && dims[1] >= 5) {
    numDets = dims[0]; numClasses = dims[1] - 4; transposed = true;
  } else { return []; }

  for (let i = 0; i < numDets; i++) {
    let cx: number, cy: number, bw: number, bh: number;
    let maxConf = 0, maxClass = 0;

    if (!transposed) {
      cx = data[0 * numDets + i]; cy = data[1 * numDets + i];
      bw = data[2 * numDets + i]; bh = data[3 * numDets + i];
      for (let c = 0; c < numClasses; c++) {
        const v = data[(4 + c) * numDets + i];
        if (v > maxConf) { maxConf = v; maxClass = c; }
      }
    } else {
      const base = i * (4 + numClasses);
      cx = data[base]; cy = data[base + 1];
      bw = data[base + 2]; bh = data[base + 3];
      for (let c = 0; c < numClasses; c++) {
        const v = data[base + 4 + c];
        if (v > maxConf) { maxConf = v; maxClass = c; }
      }
    }

    if (maxConf < confThreshold) continue;

    dets.push({
      className: COCO_CLASSES_80[maxClass] ?? `class_${maxClass}`,
      confidence: Math.round(maxConf * 1000) / 1000,
      boundingBox: {
        x: Math.max(0, (cx - bw / 2) / modelW),
        y: Math.max(0, (cy - bh / 2) / modelH),
        width: Math.min(1, bw / modelW),
        height: Math.min(1, bh / modelH),
      },
      source: 'onnx-local',
      isSimulated: false,
    });
  }
  return dets;
}

// ─── ONNX Provider ────────────────────────────────────────────────────────────

export class OnnxLocalInferenceProvider implements LocalInferenceProvider {
  readonly id = 'onnx-local';
  readonly isSimulated = false;

  private _status: LocalInferenceProviderStatus = 'not-initialized';
  private _session: OrtSession | null = null;
  private _ort: OrtModule | null = null;
  private _modelPath: string | null = null;
  private _inputName = 'images';
  private _outputName = 'output0';
  private _framesProcessed = 0;

  getStatus(): LocalInferenceProviderStatus { return this._status; }

  async initialize(modelPath: string): Promise<LocalInferenceProviderStatus> {
    this._status = 'loading';
    this._modelPath = modelPath;

    this._ort = await tryLoadOrt();
    if (!this._ort) {
      this._status = 'runtime-unavailable';
      return this._status;
    }

    const resolved = path.resolve(modelPath);
    if (!fs.existsSync(resolved)) {
      this._status = 'model-not-found';
      return this._status;
    }

    try {
      this._session = await this._ort.InferenceSession.create(resolved, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
      if (this._session.inputNames.length > 0) this._inputName = this._session.inputNames[0];
      if (this._session.outputNames.length > 0) this._outputName = this._session.outputNames[0];
      this._status = 'ready';
    } catch {
      this._status = 'model-load-failed';
    }
    return this._status;
  }

  async runInference(frame: InferenceFrameInput): Promise<InferenceResult> {
    const t0 = Date.now();

    if (this._status !== 'ready' || !this._session || !this._ort) {
      return {
        detections: [],
        inferenceLatencyMs: 0,
        providerStatus: this._status,
        modelPath: this._modelPath,
        error: `Provider not ready: ${this._status}. No fabricated detections returned.`,
        framesProcessed: this._framesProcessed,
      };
    }

    if (!frame.pixels) {
      return {
        detections: [],
        inferenceLatencyMs: 0,
        providerStatus: this._status,
        modelPath: this._modelPath,
        error: 'Frame contains no pixel data. Cannot run inference without real camera bytes.',
        framesProcessed: this._framesProcessed,
      };
    }

    const spec = DEFAULT_MODEL_INPUT_SPEC;
    try {
      const resized = resizeBilinear(frame.pixels, frame.width, frame.height, spec.width, spec.height);
      const nchw = transposeHWCtoNCHW(resized, spec.height, spec.width);
      const tensor = new this._ort.Tensor('float32', nchw, [1, 3, spec.height, spec.width]);
      const out = await this._session.run({ [this._inputName]: tensor });
      const outTensor = out[this._outputName];
      if (!outTensor) throw new Error(`Output '${this._outputName}' not in model outputs`);

      const rawDets = decodeYolov8(
        outTensor.data as Float32Array,
        outTensor.dims,
        spec.width, spec.height,
        DEFAULT_CONFIDENCE_THRESHOLD,
      );
      const dets = applyNMS(rawDets, DEFAULT_NMS_IOU_THRESHOLD);
      this._framesProcessed++;
      return {
        detections: dets,
        inferenceLatencyMs: Date.now() - t0,
        providerStatus: 'ready',
        modelPath: this._modelPath,
        error: null,
        framesProcessed: this._framesProcessed,
      };
    } catch (err) {
      this._status = 'inference-error';
      return {
        detections: [],
        inferenceLatencyMs: Date.now() - t0,
        providerStatus: 'inference-error',
        modelPath: this._modelPath,
        error: `Inference failed: ${err instanceof Error ? err.message : String(err)}`,
        framesProcessed: this._framesProcessed,
      };
    }
  }

  async shutdown(): Promise<void> {
    if (this._session) {
      try { await this._session.release(); } catch { /* best effort */ }
      this._session = null;
    }
    this._status = 'shutdown';
  }
}

// ─── Mock Test Provider ───────────────────────────────────────────────────────
// For automated tests ONLY. All detections are explicitly labeled isSimulated: true.
// This class MUST NOT be used in embedded-prototype mode.

export class MockOnnxInferenceProvider implements LocalInferenceProvider {
  readonly id = 'mock-onnx-test';
  readonly isSimulated = true;

  private _status: LocalInferenceProviderStatus = 'not-initialized';
  private _framesProcessed = 0;
  private readonly _mockedDetections: InferenceDetection[];

  constructor(mockedDetections: InferenceDetection[] = []) {
    this._mockedDetections = mockedDetections;
  }

  getStatus(): LocalInferenceProviderStatus { return this._status; }

  async initialize(_modelPath: string): Promise<LocalInferenceProviderStatus> {
    this._status = 'ready';
    return 'ready';
  }

  async runInference(_frame: InferenceFrameInput): Promise<InferenceResult> {
    if (this._status !== 'ready') {
      return {
        detections: [],
        inferenceLatencyMs: 0,
        providerStatus: this._status,
        modelPath: null,
        error: 'Mock provider not ready',
        framesProcessed: this._framesProcessed,
      };
    }
    this._framesProcessed++;
    return {
      detections: this._mockedDetections.map(d => ({ ...d, isSimulated: true, source: 'mock-test' as const })),
      inferenceLatencyMs: 1,
      providerStatus: 'ready',
      modelPath: 'mock',
      error: null,
      framesProcessed: this._framesProcessed,
    };
  }

  async shutdown(): Promise<void> {
    this._status = 'shutdown';
  }
}
