import { ok, err, handleError } from '@/lib/api';
import { addAlertFeedback } from '@/engines/pilotTestingEngine';
import { savePilotSession, getPilotSession } from '@/lib/pilotStore';
import type { AlertFeedback } from '@/types/pilot';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId: string; feedback: AlertFeedback };
    const { sessionId, feedback } = body;

    if (!sessionId || !feedback) {
      return err('sessionId and feedback are required', 400);
    }

    const session = getPilotSession(sessionId);
    if (!session) return err('Session not found', 404);
    if (session.deleted) return err('Session data has been deleted', 410);

    const updated = addAlertFeedback(session, {
      ...feedback,
      timestamp: new Date().toISOString(),
    });

    savePilotSession(updated);
    return ok({ feedbackCount: updated.feedbackItems.length });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) return err('id is required', 400);

    const session = getPilotSession(sessionId);
    if (!session) return err('Session not found', 404);
    if (session.deleted) return err('Session data has been deleted', 410);

    return ok({ feedbackItems: session.feedbackItems });
  } catch (e) {
    return handleError(e);
  }
}
