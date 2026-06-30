import { z } from 'zod';
import { ok, err, handleError } from '@/lib/api';
import { endSession, getSession } from '@/lib/sessionStore';

const schema = z.object({ sessionId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = getSession(body.sessionId);
    if (!session) return err('Session not found', 404);
    endSession(body.sessionId);
    return ok({ sessionId: body.sessionId, ended: true });
  } catch (e) {
    return handleError(e);
  }
}
