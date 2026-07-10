// ─── ONNX Runtime Availability Check ─────────────────────────────────────────
// Reports whether onnxruntime-node is installed, the model path is present,
// and whether a model file can be loaded. Run before embedded-prototype bring-up.
//
// Usage: cd denarixx && npm run check:onnx
// Or:    DENARIXX_LOCAL_MODEL_PATH=/path/to/model.onnx npm run check:onnx
//
// Exit codes:
//   0 — ONNX runtime installed AND model found (hardware ready)
//   1 — ONNX runtime missing OR model not found (see output for details)
//   2 — ONNX runtime installed but model fails to load (corrupt/incompatible model)

import { existsSync } from 'fs';
import { resolve } from 'path';

const MODEL_PATH = process.env.DENARIXX_LOCAL_MODEL_PATH ?? '/opt/denarixx/models/hazard-detection.onnx';
const SECTION = (s: string) => console.log(`\n${'─'.repeat(50)}\n${s}\n${'─'.repeat(50)}`);

SECTION('Denarixx Vision: ONNX Runtime Check');

// ─── 1. Check onnxruntime-node availability ────────────────────────────────

console.log('\n[1] onnxruntime-node');
let ort: { InferenceSession: { create: (p: string, opts?: object) => Promise<unknown> } } | null = null;
try {
  ort = await import('onnxruntime-node') as typeof ort;
  console.log('  ✓ onnxruntime-node is installed and importable');
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
    console.log('  ✗ onnxruntime-node is NOT installed');
    console.log('    To install: npm install onnxruntime-node (on ARM64 Linux hardware only)');
    console.log('    Note: onnxruntime-node is an optional dependency — not required for simulation/browser modes');
  } else {
    console.log('  ✗ onnxruntime-node import error:', msg);
    console.log('    This may indicate a platform incompatibility (onnxruntime-node requires Linux/ARM64)');
  }
}

// ─── 2. Check model file path ─────────────────────────────────────────────

console.log('\n[2] Model file');
console.log(`  Path: ${MODEL_PATH}`);
const resolvedPath = resolve(MODEL_PATH);
const modelExists = existsSync(resolvedPath);

if (modelExists) {
  console.log('  ✓ Model file found at resolved path:', resolvedPath);
} else {
  console.log('  ✗ Model file NOT found at:', resolvedPath);
  console.log('    Set DENARIXX_LOCAL_MODEL_PATH to point to your .onnx model file');
  console.log('    Download or convert a hazard-detection model (YOLOv8 ONNX format recommended)');
}

// ─── 3. Attempt model load (only if both are available) ───────────────────

console.log('\n[3] Model load test');
let exitCode = 0;

if (!ort) {
  console.log('  [SKIP] onnxruntime-node not available — skipping model load test');
  exitCode = 1;
} else if (!modelExists) {
  console.log('  [SKIP] Model file not found — skipping model load test');
  exitCode = 1;
} else {
  try {
    const session = await (ort as any).InferenceSession.create(resolvedPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    console.log('  ✓ Model loaded successfully');

    const inputNames: string[] = (session as any).inputNames;
    const outputNames: string[] = (session as any).outputNames;
    console.log('  Input names:', inputNames);
    console.log('  Output names:', outputNames);

    const inputDesc = inputNames.map((name: string) => {
      const meta = (session as any).inputMetadata?.[name];
      if (meta) return `${name}: ${meta.type}[${meta.dimensions?.join(',') ?? '?'}]`;
      return name;
    });
    if (inputDesc.length) console.log('  Input details:', inputDesc.join(', '));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('  ✗ Model failed to load:', msg);
    console.log('    Verify the model is valid ONNX v8+ format compatible with onnxruntime-node');
    exitCode = 2;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────

SECTION('Summary');

const runtimeOk = ort !== null;
const modelOk = modelExists;

console.log(`  onnxruntime-node installed : ${runtimeOk ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Model file found           : ${modelOk ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Ready for embedded-prototype: ${runtimeOk && modelOk && exitCode === 0 ? 'YES ✓' : 'NO ✗'}`);

if (!runtimeOk || !modelOk || exitCode !== 0) {
  console.log('\n  Embedded-prototype mode requires both onnxruntime-node AND a valid model file.');
  console.log('  In Replit / CI: use DENARIXX_HAL_ADAPTER=simulation-test (no hardware required).');
  console.log('  On physical hardware: install onnxruntime-node and provide the ONNX model path.');
}

process.exit(exitCode);
