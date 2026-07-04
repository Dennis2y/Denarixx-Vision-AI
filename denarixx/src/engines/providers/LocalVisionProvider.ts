/**
 * LocalVisionProvider (V4 — placeholder)
 *
 * Integration slot for on-device / self-hosted vision models
 * (e.g. Ollama + LLaVA, ONNX, TensorFlow.js, or a local REST endpoint).
 * Currently falls back to SimulationVisionProvider.
 *
 * To activate: set VISION_PROVIDER=local and LOCAL_VISION_ENDPOINT in environment.
 * Implementation target: Phase 5.
 */

import type { VisionAnalysisProvider, VisionAnalysisV4 } from '@/types/vision';
import type { VisionFrame } from '@/types';
import { SimulationVisionProvider } from './SimulationVisionProvider';

export class LocalVisionProvider implements VisionAnalysisProvider {
  readonly providerName = 'LocalVisionProvider';
  readonly isRealAI = false;
  private fallback = new SimulationVisionProvider();

  async analyzeFrameV4(
    frame: VisionFrame,
    imageData: string | null
  ): Promise<VisionAnalysisV4> {
    console.warn(
      '[LocalVisionProvider] Not yet implemented — falling back to simulation. ' +
        'Set VISION_PROVIDER=simulation or implement the local model integration.'
    );
    const result = await this.fallback.analyzeFrameV4(frame, imageData);
    return {
      ...result,
      usedFallback: true,
      provider: `${this.providerName}/not-implemented-fallback`,
    };
  }
}
