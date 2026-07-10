// In-process session state store used by WebSocket live events.
// Keyed by sessionId. Lightweight for Phase 1.

export interface LiveSession {
  id: string;
  startedAt: Date;
  isActive: boolean;
  frameCount: number;
  alertCount: number;
  latencyMs: number[];
  lastScene: string | null;
}

const sessions = new Map<string, LiveSession>();

export function createSession(id: string): LiveSession {
  const s: LiveSession = {
    id,
    startedAt: new Date(),
    isActive: true,
    frameCount: 0,
    alertCount: 0,
    latencyMs: [],
    lastScene: null,
  };
  sessions.set(id, s);
  return s;
}

export function getSession(id: string): LiveSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<LiveSession>): void {
  const s = sessions.get(id);
  if (s) sessions.set(id, { ...s, ...patch });
}

export function endSession(id: string): void {
  const s = sessions.get(id);
  if (s) sessions.set(id, { ...s, isActive: false });
}

export function getAllSessions(): LiveSession[] {
  return Array.from(sessions.values());
}
