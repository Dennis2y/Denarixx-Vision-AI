import { ok, err, handleError } from '@/lib/api';
import { createLandmark, addLandmarkToSession, buildLandmarkAnnouncement } from '@/engines/landmarkGuidanceEngine';
import { getNavigationSession, saveNavigationSession } from '@/lib/navigationStore';
import type { LandmarkType } from '@/types/navigation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, name, type, description, estimatedDistanceM } = body as {
      sessionId?: string;
      name?: string;
      type?: LandmarkType;
      description?: string;
      estimatedDistanceM?: number;
    };

    if (!sessionId) return err('sessionId is required', 400);
    if (!name?.trim()) return err('name is required', 400);

    const session = getNavigationSession(sessionId);
    if (!session) return err('Session not found', 404);

    const landmark = createLandmark(name.trim(), type ?? 'custom', {
      description,
      estimatedDistanceM,
    });
    const updated = addLandmarkToSession(session, landmark);
    saveNavigationSession(updated);

    return ok({
      landmark,
      announcement: buildLandmarkAnnouncement(landmark),
      totalLandmarks: updated.landmarks.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
