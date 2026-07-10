import { ok, err, handleError } from '@/lib/api';
import { endNavigationSession } from '@/engines/navigationIntelligenceEngine';
import { getNavigationSession, saveNavigationSession } from '@/lib/navigationStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) return err('sessionId is required', 400);

    const session = getNavigationSession(sessionId);
    if (!session) return err('Session not found', 404);

    const ended = endNavigationSession(session);
    saveNavigationSession(ended);

    return ok({
      sessionId: ended.sessionId,
      state: ended.state,
      destination: ended.destination,
      endedAt: ended.lastUpdatedAt,
    });
  } catch (e) {
    return handleError(e);
  }
}
