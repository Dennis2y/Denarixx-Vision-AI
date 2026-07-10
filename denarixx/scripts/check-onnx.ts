// ─── ONNX Runtime Model Compatibility Check ───────────────────────────────────
// Reports whether onnxruntime-node is installed, the model file is present,
// can be loaded, and whether a test frame can execute. Run before embedded-
// prototype bring-up to confirm the inference stack is functional.
//
// Usage: cd denarixx && npm run check:onnx
// Or:    DENARIXX_LOCAL_MODEL_PATH=/path/to/model.onnx npm run check:onnx
//
// Exit codes:
//   0 — ONNX runtime installed AND model found AND model loads (hardware ready)
//   1 — ONNX runtime missing OR model not found (see output for details)
//   2 — ONNX runtime installed but model fails to load or test-frame fails

import { existsSync, statSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

const MODEL_PATH = process.env.DENARIXX_LOCAL_MODEL_PATH ?? '/opt/denarixx/models/hazard-detection.onnx';
const SECTION = (s: string) => console.log(`\n${'─'.repeat(60)}\n${s}\n${'─'.repeat(60)}`);
const OK   = (s: string) => console.log(`  ✓ ${s}`);
const FAIL = (s: string) => console.log(`  ✗ ${s}`);
const INFO = (s: string) => console.log(`  ${s}`);
const SKIP = (s: string) => console.log(`  [SKIP] ${s}`);

SECTION('Denarixx Vision: ONNX Runtime Compatibility Check');

// ─── 1. onnxruntime-node availability ─────────────────────────────────────────

console.log('\n[1] onnxruntime-node runtime');
let ort: { InferenceSession: {
  create: (p: string, opts?: object) => Promise<unknown>;
} } | null = null;

try {
  ort = await import('onnxruntime-node') as typeof ort;
  OK('onnxruntime-node is installed and importable');
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
    FAIL('onnxruntime-node is NOT installed');
    INFO('To install: npm install onnxruntime-node  (ARM64 Linux hardware only)');
    INFO('Note: optional dependency — not required for simulation/browser modes');
  } else {
    FAIL(`onnxruntime-node import error: ${msg}`);
    INFO('This may indicate a platform incompatibility (requires Linux/ARM64)');
  }
}

// ─── 2. Model file ────────────────────────────────────────────────────────────

console.log('\n[2] Model file');
INFO(`Path: ${MODEL_PATH}`);
const resolvedPath = resolve(MODEL_PATH);
const modelExists = existsSync(resolvedPath);

let modelChecksum = '';

if (modelExists) {
  OK(`Model file found at: ${resolvedPath}`);
  try {
    const modelSizeBytes = statSync(resolvedPath).size;
    INFO(`File size: ${(modelSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  } catch {
    INFO('Could not read file size');
  }
  try {
    const buf = readFileSync(resolvedPath);
    modelChecksum = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    OK(`SHA-256 (first 16 chars): ${modelChecksum}`);
  } catch {
    INFO('Could not compute checksum (file may be very large — skipping)');
  }
} else {
  FAIL(`Model file NOT found at: ${resolvedPath}`);
  INFO('Set DENARIXX_LOCAL_MODEL_PATH to your .onnx model file path');
  INFO('Recommended format: YOLOv8 ONNX (opset ≥ 12, dynamic batch)');
}

// ─── 3. Model load and metadata ───────────────────────────────────────────────

console.log('\n[3] Model load and metadata');

let exitCode = 0;
let session: unknown = null;

if (!ort) {
  SKIP('onnxruntime-node not available — cannot load model');
  exitCode = 1;
} else if (!modelExists) {
  SKIP('Model file not found — cannot load model');
  exitCode = 1;
} else {
  try {
    session = await (ort as any).InferenceSession.create(resolvedPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    OK('Model loaded successfully');

    const inputNames: string[] = (session as any).inputNames ?? [];
    const outputNames: string[] = (session as any).outputNames ?? [];

    INFO(`Input names  : ${inputNames.join(', ') || '(none reported)'}`);
    INFO(`Output names : ${outputNames.join(', ') || '(none reported)'}`);

    for (const name of inputNames) {
      const meta = (session as any).inputMetadata?.[name];
      if (meta) {
        const dims = meta.dimensions?.join(' × ') ?? '?';
        INFO(`  [${name}] type=${meta.type}  shape=[${dims}]`);
        if (meta.dimensions) {
          const [, channels, height, width] = meta.dimensions as number[];
          if (channels && height && width) {
            const fmt = channels === 3 ? 'RGB' : channels === 1 ? 'Grayscale' : `${channels}-channel`;
            INFO(`  → pixel format: ${fmt}, input size: ${width}×${height}`);
          }
        }
      }
    }

    for (const name of outputNames) {
      const meta = (session as any).outputMetadata?.[name];
      if (meta) {
        const dims = meta.dimensions?.join(' × ') ?? '?';
        INFO(`  [${name}] type=${meta.type}  shape=[${dims}]`);
      }
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    FAIL(`Model failed to load: ${msg}`);
    INFO('Verify the model is valid ONNX v8+ format compatible with onnxruntime-node');
    exitCode = 2;
  }
}

// ─── 4. Test-frame execution ───────────────────────────────────────────────────

console.log('\n[4] Test-frame execution (synthetic 640×480 RGB frame)');

if (!session || !ort) {
  SKIP('Session not available — skipping test-frame execution');
} else {
  try {
    const { Tensor } = await import('onnxruntime-node') as { Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown };
    const inputNames: string[] = (session as any).inputNames ?? [];
    if (inputNames.length === 0) {
      SKIP('No input names reported — skipping test-frame execution');
    } else {
      const W = 640, H = 480, C = 3;
      const data = new Float32Array(W * H * C);
      const tensor = new Tensor('float32', data, [1, C, H, W]);
      const feeds: Record<string, unknown> = { [inputNames[0]]: tensor };

      const t0 = Date.now();
      await (session as any).run(feeds);
      const latencyMs = Date.now() - t0;

      OK(`Test-frame executed successfully in ${latencyMs} ms`);
      if (latencyMs <= 100) {
        INFO('Latency grade: EXCELLENT (≤100ms)');
      } else if (latencyMs <= 300) {
        INFO('Latency grade: ACCEPTABLE (≤300ms)');
      } else if (latencyMs <= 500) {
        INFO('Latency grade: MARGINAL (≤500ms — target budget)');
      } else {
        INFO(`Latency grade: CRITICAL (${latencyMs}ms — exceeds 500ms budget)`);
        INFO('Consider model quantization (INT8) or reducing input resolution');
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    FAIL(`Test-frame execution failed: ${msg}`);
    INFO('Model may require specific input shape or preprocessing');
    if (exitCode === 0) exitCode = 2;
  }
}

// ─── 5. Decoder configuration compatibility ───────────────────────────────────

console.log('\n[5] Decoder configuration');

const SUPPORTED_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
  'traffic light', 'stop sign', 'bench',
  'backpack', 'umbrella', 'handbag', 'suitcase',
  'bottle', 'cup', 'knife', 'bowl',
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet',
  'tv', 'laptop', 'cell phone', 'book',
  'stairs', 'step', 'obstacle', 'door', 'vehicle',
];
const CONFIDENCE_THRESHOLD = 0.35;

INFO(`Supported classes    : ${SUPPORTED_CLASSES.length} (COCO-SSD compatible + hazard classes)`);
INFO(`Confidence threshold : ${CONFIDENCE_THRESHOLD}`);
INFO(`Decoder format       : [x1, y1, x2, y2, confidence, class_id] per detection`);

if (session) {
  const outputNames: string[] = (session as any).outputNames ?? [];
  if (outputNames.length > 0) {
    OK('Output names present — decoder can attempt to consume model output');
  } else {
    INFO('No output names — verify model exports are named correctly');
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

SECTION('Compatibility Summary');

const runtimeOk = ort !== null;
const modelOk   = modelExists;
const loadOk    = session !== null;
const checksumStr = modelChecksum ? `${modelChecksum}…` : 'N/A';

console.log(`  onnxruntime-node installed  : ${runtimeOk ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Model file found            : ${modelOk   ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Model SHA-256 (partial)     : ${checksumStr}`);
console.log(`  Model loads without error   : ${loadOk    ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Test-frame execution        : ${loadOk ? (exitCode === 0 ? 'PASS ✓' : 'FAIL ✗') : 'SKIP'}`);
console.log(`  Ready for embedded-prototype: ${runtimeOk && modelOk && loadOk && exitCode === 0 ? 'YES ✓' : 'NO ✗'}`);

if (!runtimeOk || !modelOk || !loadOk || exitCode !== 0) {
  console.log('');
  console.log('  Embedded-prototype requires onnxruntime-node + a valid ONNX model.');
  console.log('  In Replit / CI: use DENARIXX_HAL_ADAPTER=simulation-test (no hardware).');
  console.log('  On physical hardware: install onnxruntime-node and provide the model path.');
  if (!runtimeOk) console.log('  → Install: npm install onnxruntime-node (ARM64 Linux only)');
  if (!modelOk)   console.log('  → Model:   set DENARIXX_LOCAL_MODEL_PATH=/path/to/model.onnx');
}

process.exit(exitCode);
