// ─── V13 Navigation Session Store ────────────────────────────────────────────
// In-memory store. Resets on Next.js hot-reload (expected dev behaviour).

import type { NavigationSession } from '@/types/navigation';

const store = new Map<string, NavigationSession>();

export function getNavigationSession(sessionId: string): NavigationSession | undefined {
  return store.get(sessionId);
}

export function saveNavigationSession(session: NavigationSession): void {
  store.set(session.sessionId, session);
}

export function deleteNavigationSession(sessionId: string): boolean {
  return store.delete(sessionId);
}

export function listNavigationSessions(): NavigationSession[] {
  return Array.from(store.values());
}

export function clearNavigationSessions(): void {
  store.clear();
}

export function navigationSessionCount(): number {
  return store.size;
}
