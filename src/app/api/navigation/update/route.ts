import { ok, err, handleError } from '@/lib/api';
import { updateNavigationSession, selectGuidance, currentSegment } from '@/engines/navigationIntelligenceEngine';
import { getNavigationSession, saveNavigationSession } from '@/lib/navigationStore';
import type { NavigationUpdate } from '@/types/navigation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, headingDeg, distanceTraveledM, detectedLabels, crossingAttempt } = body as {
      sessionId?: string;
      headingDeg?: number;
      distanceTraveledM?: number;
      detectedLabels?: string[];
      crossingAttempt?: boolean;
    };

    if (!sessionId) return err('sessionId is required', 400);
    const session = getNavigationSession(sessionId);
    if (!session) return err('Session not found', 404);

    const update: NavigationUpdate = {
      headingDeg,
      distanceTraveledM,
      detectedLabels,
      crossingAttempt,
    };

    const updated = updateNavigationSession(session, update);
    const guidance = selectGuidance(updated, 0, Date.now());
    saveNavigationSession(updated);
    const seg = currentSegment(updated);

    return ok({
      sessionId: updated.sessionId,
      state: updated.state,
      riskLevel: updated.riskLevel,
      currentSegment: seg
        ? { instruction: seg.instruction, type: seg.type, distanceM: seg.estimatedDistanceM }
        : null,
      guidance: guidance?.text ?? null,
      distanceRemainingM: updated.distanceRemainingM,
      currentHeadingDeg: updated.currentHeadingDeg,
    });
  } catch (e) {
    return handleError(e);
  }
}
