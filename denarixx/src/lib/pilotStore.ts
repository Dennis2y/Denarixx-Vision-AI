// ─── In-memory Pilot Session Store ──────────────────────────────────────────
// Keyed by sessionId. Resets on server restart. No data is persisted.

import type { PilotSession } from '@/types/pilot';

const store = new Map<string, PilotSession>();

export function savePilotSession(session: PilotSession): void {
  store.set(session.sessionId, session);
}

export function getPilotSession(sessionId: string): PilotSession | undefined {
  return store.get(sessionId);
}

export function deletePilotSession(sessionId: string): boolean {
  return store.delete(sessionId);
}

export function getAllPilotSessions(): PilotSession[] {
  return Array.from(store.values());
}
