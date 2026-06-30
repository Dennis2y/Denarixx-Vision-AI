import { ok, handleError } from '@/lib/api';
import { getAllSessions } from '@/lib/sessionStore';

export async function GET() {
  try {
    const sessions = getAllSessions();
    return ok({
      sessions,
      active: sessions.filter((s) => s.isActive).length,
      total: sessions.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
