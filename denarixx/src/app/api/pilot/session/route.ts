import { v4 as uuidv4 } from 'uuid';
import { ok, err, handleError } from '@/lib/api';
import { createPilotSession, deletePilotData, generateReport } from '@/engines/pilotTestingEngine';
import { savePilotSession, getPilotSession, deletePilotSession } from '@/lib/pilotStore';
import type { PilotScenario, TesterConsent } from '@/types/pilot';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { scenario: PilotScenario; consent: TesterConsent };
    const { scenario, consent } = body;

    if (!scenario || !consent) {
      return err('scenario and consent are required', 400);
    }

    const sessionId = uuidv4();
    const session = createPilotSession(sessionId, scenario, consent);
    savePilotSession(session);

    return ok({ sessionId, startedAt: session.startedAt });
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

    return ok({ session });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) return err('id is required', 400);

    const session = getPilotSession(sessionId);
    if (!session) return err('Session not found', 404);

    const redacted = deletePilotData(session);
    savePilotSession(redacted);
    deletePilotSession(sessionId);

    return ok({ deleted: true, sessionId });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { sessionId: string; action: 'end' | 'report' };
    const { sessionId, action } = body;

    if (!sessionId || !action) return err('sessionId and action are required', 400);

    const session = getPilotSession(sessionId);
    if (!session) return err('Session not found', 404);
    if (session.deleted) return err('Session data has been deleted', 410);

    if (action === 'end') {
      const ended = { ...session, endedAt: new Date().toISOString() };
      const durationMs = new Date(ended.endedAt!).getTime() - new Date(session.startedAt).getTime();
      const final = { ...ended, durationMs };
      savePilotSession(final);
      return ok({ session: final });
    }

    if (action === 'report') {
      const report = generateReport(session);
      return ok({ report });
    }

    return err('Unknown action', 400);
  } catch (e) {
    return handleError(e);
  }
}
