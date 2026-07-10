// ─── Local Inference Provider Factory ────────────────────────────────────────
// Selects the correct inference provider for the active adapter mode.
//
// embedded-prototype  → OnnxLocalInferenceProvider (real; never mock)
// browser-development → OnnxLocalInferenceProvider (graceful unsupported result)
// simulation-test     → MockOnnxInferenceProvider  (explicitly labeled isSimulated: true)
//
// The factory enforces that simulation-test never produces isSimulated: false detections
// and that embedded-prototype never receives isSimulated: true detections.

import type { HardwareAdapterMode } from '@/types/localInference';
import type { LocalInferenceProvider, InferenceDetection } from './localInferenceProviderTypes';
import { OnnxLocalInferenceProvider, MockOnnxInferenceProvider } from './onnxLocalInferenceProvider';

export function createLocalInferenceProvider(
  mode: HardwareAdapterMode,
  mockedDetections?: InferenceDetection[],
): LocalInferenceProvider {
  switch (mode) {
    case 'simulation-test':
      return new MockOnnxInferenceProvider(mockedDetections ?? []);

    case 'embedded-prototype':
      // Real ONNX only. If runtime unavailable, returns empty + error — never mocks.
      return new OnnxLocalInferenceProvider();

    case 'browser-development':
      // ONNX Node.js runtime; gracefully reports 'runtime-unavailable' in browser context.
      return new OnnxLocalInferenceProvider();
  }
}

// ─── Embedded-Mode Safety Guard ───────────────────────────────────────────────
// Call before delivering detections to the Guardian pipeline in embedded mode.
// Throws if any detection carries isSimulated: true — that means a mock provider
// was incorrectly wired for real-user operation.

export class EmbeddedSimulatedDetectionError extends Error {
  constructor(detectionCount: number) {
    super(
      `SAFETY VIOLATION: ${detectionCount} simulated detection(s) reached the Guardian pipeline ` +
      `in embedded-prototype mode. Simulated detections must never drive real-user safety decisions. ` +
      `Check that the inference provider was created with createLocalInferenceProvider('embedded-prototype').`,
    );
    this.name = 'EmbeddedSimulatedDetectionError';
  }
}

export function assertNoSimulatedDetectionsInEmbeddedMode(
  mode: HardwareAdapterMode,
  detections: InferenceDetection[],
): void {
  if (mode !== 'embedded-prototype') return;
  const simulated = detections.filter(d => d.isSimulated);
  if (simulated.length > 0) {
    throw new EmbeddedSimulatedDetectionError(simulated.length);
  }
}
