import sharp from 'sharp';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { OnnxLocalInferenceProvider } from '../src/runtime/inference/onnxLocalInferenceProvider';
import {
  createEmbeddedGuardianContext,
  runEmbeddedGuardianPipeline,
} from '../src/runtime/embeddedGuardianOrchestrator';

async function main(): Promise<void> {
  const imagePath = process.env.DENARIXX_TEST_IMAGE;
  const modelPath = process.env.DENARIXX_LOCAL_MODEL_PATH;

  if (!imagePath) {
    throw new Error('DENARIXX_TEST_IMAGE is required.');
  }

  if (!modelPath) {
    throw new Error('DENARIXX_LOCAL_MODEL_PATH is required.');
  }

  const resolvedImage = resolve(imagePath);
  const resolvedModel = resolve(modelPath);

  if (!existsSync(resolvedImage)) {
    throw new Error(`Image not found: ${resolvedImage}`);
  }

  if (!existsSync(resolvedModel)) {
    throw new Error(`Model not found: ${resolvedModel}`);
  }

  console.log('\nDenarixx Vision AI — Real Image Validation');
  console.log('='.repeat(60));
  console.log(`Image: ${resolvedImage}`);
  console.log(`Model: ${resolvedModel}`);

  const decoded = await sharp(resolvedImage)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = decoded;

  if (info.channels !== 3) {
    throw new Error(
      `Expected RGB image with 3 channels, received ${info.channels}.`,
    );
  }

  const provider = new OnnxLocalInferenceProvider();

  try {
    const status = await provider.initialize(resolvedModel);

    console.log(`\nProvider status: ${status}`);

    if (status !== 'ready') {
      throw new Error(`ONNX provider failed to initialize: ${status}`);
    }

    const inference = await provider.runInference({
      pixels: new Uint8Array(data),
      width: info.width,
      height: info.height,
      frameId: 1,
      timestampMs: Date.now(),
    });

    console.log('\nInference');
    console.log('-'.repeat(60));
    console.log(`Status: ${inference.providerStatus}`);
    console.log(`Latency: ${inference.inferenceLatencyMs} ms`);
    console.log(`Detections: ${inference.detections.length}`);

    if (inference.error) {
      console.log(`Error: ${inference.error}`);
    }

    const sorted = [...inference.detections].sort(
      (a, b) => b.confidence - a.confidence,
    );

    for (const [index, detection] of sorted.entries()) {
      const box = detection.boundingBox;

      console.log(
        `${index + 1}. ${detection.className}` +
          ` | confidence ${(detection.confidence * 100).toFixed(1)}%` +
          ` | x=${box.x.toFixed(3)}` +
          ` y=${box.y.toFixed(3)}` +
          ` w=${box.width.toFixed(3)}` +
          ` h=${box.height.toFixed(3)}` +
          ` | simulated=${detection.isSimulated}`,
      );
    }

    const guardianContext = createEmbeddedGuardianContext();

    const guardianResult = await runEmbeddedGuardianPipeline(
      {
        detections: inference.detections,
        frameTimestampMs: Date.now(),
        providerSource: 'onnx-local',
      },
      guardianContext,
    );

    const output = guardianResult.output;

    console.log('\nCognitive Guardian');
    console.log('-'.repeat(60));
    console.log(`Risk level: ${output.riskLevel}`);
    console.log(`Recommended action: ${output.recommendedAction}`);
    console.log(`Should speak: ${output.shouldSpeak}`);
    console.log(`Should interrupt: ${output.shouldInterrupt}`);
    console.log(`Message: ${output.message ?? '(silent)'}`);
    console.log(`Haptic pattern: ${output.hapticPattern ?? '(none)'}`);
    console.log(`Confidence: ${(output.confidence * 100).toFixed(1)}%`);
    console.log(`Reason: ${output.decisionReason}`);

    if (output.uncertaintyStatement) {
      console.log(`Uncertainty: ${output.uncertaintyStatement}`);
    }

    console.log('\nValidation result');
    console.log('-'.repeat(60));

    if (inference.detections.length === 0) {
      console.log('MODEL RAN SUCCESSFULLY, but no supported objects were detected.');
    } else {
      console.log('PASS: Real image produced real ONNX detections.');
      console.log('PASS: Detections reached the Cognitive Guardian.');
    }
  } finally {
    await provider.shutdown();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);

  console.error('\nReal-image validation failed:');
  console.error(message);
  process.exitCode = 1;
});
