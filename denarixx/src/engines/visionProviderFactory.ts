/**
 * Vision Provider Factory (V4)
 *
 * Reads the VISION_PROVIDER environment variable and returns the appropriate
 * VisionAnalysisProvider singleton. Valid values:
 *
 *   simulation  — SimulationVisionProvider (default, no API key required)
 *   openai      — OpenAIVisionProvider (requires OPENAI_API_KEY)
 *   gemini      — GeminiVisionProvider  (requires GEMINI_API_KEY)  ← Sprint 4: real
 *   local       — LocalVisionProvider  (placeholder, falls back to simulation)
 *
 * This module is server-side only. API keys are read from process.env and are
 * never exposed to the browser.
 *
 * Sprint 4: GeminiVisionProvider is now a real implementation. The factory
 * checks for GEMINI_API_KEY and falls back to simulation when it is absent.
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

    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn(
          '[VisionProviderFactory] VISION_PROVIDER=gemini but GEMINI_API_KEY is not set — ' +
            'falling back to simulation. Set GEMINI_API_KEY to enable Gemini vision analysis.'
        );
        return new SimulationVisionProvider();
      }
      console.info('[VisionProviderFactory] Using GeminiVisionProvider (gemini-1.5-flash)');
      return new GeminiVisionProvider(apiKey);
    }

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
