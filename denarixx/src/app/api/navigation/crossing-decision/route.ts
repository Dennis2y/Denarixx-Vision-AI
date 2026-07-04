import { ok, err, handleError } from '@/lib/api';
import {
  evaluateCrossing,
  buildCrossingMessage,
  formatCrossingType,
} from '@/engines/crossingDecisionEngine';
import { getNavigationSession, saveNavigationSession } from '@/lib/navigationStore';
import type { OutdoorEnvironment } from '@/types/navigation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, detectedLabels, environment } = body as {
      sessionId?: string;
      detectedLabels?: string[];
      environment?: OutdoorEnvironment;
    };

    if (!sessionId) return err('sessionId is required', 400);

    const session = sessionId ? getNavigationSession(sessionId) : null;
    const labels = detectedLabels ?? [];
    const env: OutdoorEnvironment = environment ?? 'crossing';

    const decision = evaluateCrossing(labels, env);
    const message = buildCrossingMessage(
      decision.riskLevel,
      decision.vehiclesDetected,
      decision.lightState,
    );

    // Update session with latest crossing decision
    if (session) {
      saveNavigationSession({ ...session, lastCrossingDecision: decision });
    }

    return ok({
      crossingType: formatCrossingType(decision.crossingType),
      riskLevel: decision.riskLevel,
      vehiclesDetected: decision.vehiclesDetected,
      lightState: decision.lightState,
      suggestedAction: decision.suggestedAction,
      message,
      confidence: decision.confidence,
      disclaimer: 'This assessment is assistive only. Always check carefully before crossing.',
    });
  } catch (e) {
    return handleError(e);
  }
}
