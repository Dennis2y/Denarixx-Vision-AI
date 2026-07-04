import { ok, err, handleError } from '@/lib/api';
import { getNavigationEngine } from '@/engines/NavigationEngine';
import type { SceneDescription } from '@/types';

// Phase 1: simulated current scene — no live camera.
// Phase 2: replace with real vision frame from sessionStore.
const SIMULATED_SCENE: SceneDescription = {
  summary: 'You are on a pavement. Path ahead appears mostly clear.',
  confidence: 0.82,
  detections: [
    { label: 'pavement', confidence: 0.92 },
    { label: 'person', confidence: 0.65 },
  ],
  timestamp: new Date(),
  isUncertain: false,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination')?.trim() ?? '';

    if (!destination) {
      return err('destination query parameter is required', 400);
    }

    const guidance = await getNavigationEngine().guide(destination, SIMULATED_SCENE);

    return ok({
      guidance,
      destination,
      scene: {
        summary: SIMULATED_SCENE.summary,
        confidence: SIMULATED_SCENE.confidence,
        isUncertain: SIMULATED_SCENE.isUncertain,
      },
      simulated: true,
    });
  } catch (e) {
    return handleError(e);
  }
}
