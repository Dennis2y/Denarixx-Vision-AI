/**
 * Vision Provider Factory (V4)
 *
 * Reads the VISION_PROVIDER environment variable and returns the appropriate
 * VisionAnalysisProvider singleton. Valid values:
 *
 *   simulation  — SimulationVisionProvider (default, no API key required)
 *   openai      — OpenAIVisionProvider (requires OPENAI_API_KEY)
 *   gemini      — GeminiVisionProvider (placeholder, falls back to simulation)
 *   local       — LocalVisionProvider  (placeholder, falls back to simulation)
 *
 * This module is server-side only. The API key is read from process.env and
 * is never exposed to the browser.
 */

import { SimulationVisionProvider } from './providers/SimulationVisionProvider';
import { OpenAIVisionProvider } from './providers/OpenAIVisionProvider';
import { GeminiVisionProvider } from './providers/GeminiVisionProvider';
import { LocalVisionProvider } from './providers/LocalVisionProvider';
import type { VisionAnalysisProvider } from '@/types/vision';

export function createVisionAnalysisProvider(): VisionAnalysisProvider {
  const providerKey = (process.env.VISION_PROVIDER ?? 'simulation').toLowerCase().trim();

  switch (providerKey) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn(
          '[VisionProviderFactory] VISION_PROVIDER=openai but OPENAI_API_KEY is not set — ' +
            'falling back to simulation. Set OPENAI_API_KEY to enable real AI analysis.'
        );
        return new SimulationVisionProvider();
      }
      console.info('[VisionProviderFactory] Using OpenAIVisionProvider (gpt-4o)');
      return new OpenAIVisionProvider(apiKey);
    }

    case 'gemini':
      console.info('[VisionProviderFactory] Using GeminiVisionProvider (placeholder)');
      return new GeminiVisionProvider();

    case 'local':
      console.info('[VisionProviderFactory] Using LocalVisionProvider (placeholder)');
      return new LocalVisionProvider();

    case 'simulation':
      console.info('[VisionProviderFactory] Using SimulationVisionProvider');
      return new SimulationVisionProvider();

    default:
      console.warn(
        `[VisionProviderFactory] Unknown VISION_PROVIDER="${providerKey}" — falling back to simulation`
      );
      return new SimulationVisionProvider();
  }
}

// Module-level singleton — created once per server process / Next.js worker.
// Next.js hot-reload in dev will reset this automatically.
let _instance: VisionAnalysisProvider | null = null;

export function getVisionAnalysisProvider(): VisionAnalysisProvider {
  if (!_instance) {
    _instance = createVisionAnalysisProvider();
  }
  return _instance;
}

/** Reset singleton — used in tests to re-create with a different env config */
export function resetVisionAnalysisProvider(): void {
  _instance = null;
}
