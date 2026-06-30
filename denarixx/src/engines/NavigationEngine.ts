import type { INavigationEngine } from './types';
import { SAFETY_DISCLAIMER } from './types';
import type { SceneDescription, NavigationGuidance } from '@/types';

// Phase 1: rule-based navigation stubs.
// Phase 2: integrate GPS + real routing engine.

export class NavigationEngine implements INavigationEngine {
  async guide(destination: string, currentScene: SceneDescription): Promise<NavigationGuidance> {
    await new Promise((r) => setTimeout(r, 50));

    // Low confidence if scene is unclear
    if (currentScene.confidence < 0.6 || currentScene.isUncertain) {
      return {
        instruction: `Navigation to "${destination}" is not available right now. Scene confidence is too low. Please check carefully.`,
        confidence: currentScene.confidence,
        isUncertain: true,
        disclaimer: SAFETY_DISCLAIMER,
      };
    }

    // Very basic stub instructions based on destination keywords
    const dest = destination.toLowerCase();
    let instruction = '';

    if (dest.includes('exit') || dest.includes('out')) {
      instruction = 'To find the exit: follow the path ahead. I will alert you to any obstacles.';
    } else if (dest.includes('entrance') || dest.includes('door')) {
      instruction = 'Move forward carefully. A door or entrance may be ahead based on the current scene.';
    } else if (dest.includes('bus') || dest.includes('stop')) {
      instruction = 'Bus stop navigation requires GPS. Please enable location services for precise guidance.';
    } else {
      instruction = `I cannot provide precise directions to "${destination}" without GPS data. I will keep alerting you to hazards as you move.`;
    }

    return {
      instruction,
      confidence: 0.55,
      isUncertain: true,
      disclaimer: `Navigation guidance is approximate. ${SAFETY_DISCLAIMER}`,
    };
  }
}

let _instance: NavigationEngine | null = null;

export function getNavigationEngine(): NavigationEngine {
  if (!_instance) _instance = new NavigationEngine();
  return _instance;
}
