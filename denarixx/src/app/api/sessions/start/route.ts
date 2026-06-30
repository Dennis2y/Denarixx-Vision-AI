import { v4 as uuidv4 } from 'uuid';
import { ok, handleError } from '@/lib/api';
import { createSession } from '@/lib/sessionStore';

export async function POST() {
  try {
    const id = uuidv4();
    const session = createSession(id);
    return ok({ sessionId: id, startedAt: session.startedAt });
  } catch (e) {
    return handleError(e);
  }
}
