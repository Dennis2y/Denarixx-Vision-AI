/**
 * GeminiVisionProvider (V4 — placeholder)
 *
 * Integration slot for Google Gemini Vision (gemini-1.5-pro or gemini-2.0-flash).
 * Currently falls back to SimulationVisionProvider.
 *
 * To activate: set VISION_PROVIDER=gemini and GEMINI_API_KEY in environment.
 * Implementation target: Phase 5.
 */

import type { VisionAnalysisProvider, VisionAnalysisV4 } from '@/types/vision';
import type { VisionFrame } from '@/types';
import { SimulationVisionProvider } from './SimulationVisionProvider';

export class GeminiVisionProvider implements VisionAnalysisProvider {
  readonly providerName = 'GeminiVisionProvider';
  readonly isRealAI = false;
  private fallback = new SimulationVisionProvider();

  async analyzeFrameV4(
    frame: VisionFrame,
    imageData: string | null
  ): Promise<VisionAnalysisV4> {
    console.warn(
      '[GeminiVisionProvider] Not yet implemented — falling back to simulation. ' +
        'Set VISION_PROVIDER=simulation or implement the Gemini API integration.'
    );
    const result = await this.fallback.analyzeFrameV4(frame, imageData);
    return {
      ...result,
      usedFallback: true,
      provider: `${this.providerName}/not-implemented-fallback`,
    };
  }
}
