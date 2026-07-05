/**
 * RouteMemoryEngine (Sprint 8)
 *
 * Manages memory of routes the user has walked before.
 * Pure functional engine — no async, no I/O.
 *
 * Privacy: no precise GPS stored. Routes are described by
 * human-readable labels only (e.g. "Home → Corner shop").
 */

import { v4 as uuidv4 } from 'uuid';
import type { RouteMemoryEntry } from '@/types/longTermMemory';

// ─── Store ────────────────────────────────────────────────────────────────────

export function createRouteMemoryStore(): RouteMemoryEntry[] {
  return [];
}

// ─── Record ───────────────────────────────────────────────────────────────────

export function recordRouteAttempt(
  routes: RouteMemoryEntry[],
  fromLabel: string,
  toLabel: string,
  success: boolean,
  segmentCount = 1,
): RouteMemoryEntry[] {
  const normalFrom = fromLabel.trim().slice(0, 100);
  const normalTo = toLabel.trim().slice(0, 100);

  const existing = routes.find(
    (r) => r.fromLabel === normalFrom && r.toLabel === normalTo,
  );

  if (existing) {
    return routes.map((r) =>
      r.id === existing.id
        ? {
            ...r,
            totalAttempts: r.totalAttempts + 1,
            successCount: success ? r.successCount + 1 : r.successCount,
            lastUsed: new Date(),
          }
        : r,
    );
  }

  const entry: RouteMemoryEntry = {
    id: uuidv4(),
    fromLabel: normalFrom,
    toLabel: normalTo,
    segmentCount,
    successCount: success ? 1 : 0,
    totalAttempts: 1,
    lastUsed: new Date(),
    isFuzzy: true,
  };

  return [...routes, entry];
}

// ─── Query ────────────────────────────────────────────────────────────────────

export function getFrequentRoutes(
  routes: RouteMemoryEntry[],
  minSuccesses = 2,
): RouteMemoryEntry[] {
  return routes
    .filter((r) => r.successCount >= minSuccesses)
    .sort((a, b) => b.successCount - a.successCount);
}

export function findRouteByDestination(
  routes: RouteMemoryEntry[],
  toLabel: string,
): RouteMemoryEntry | null {
  const lower = toLabel.toLowerCase();
  return (
    routes
      .filter((r) => r.toLabel.toLowerCase().includes(lower))
      .sort((a, b) => b.successCount - a.successCount)[0] ?? null
  );
}

export function findRouteById(
  routes: RouteMemoryEntry[],
  id: string,
): RouteMemoryEntry | null {
  return routes.find((r) => r.id === id) ?? null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getRouteSuccessRate(route: RouteMemoryEntry): number {
  if (route.totalAttempts === 0) return 0;
  return Math.round((route.successCount / route.totalAttempts) * 100);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteRoute(
  routes: RouteMemoryEntry[],
  id: string,
): RouteMemoryEntry[] {
  return routes.filter((r) => r.id !== id);
}

export function deleteAllRoutes(): RouteMemoryEntry[] {
  return [];
}

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildRouteMemoryContext(routes: RouteMemoryEntry[]): string {
  const frequent = getFrequentRoutes(routes, 1)
    .slice(0, 3)
    .map(
      (r) =>
        `${r.fromLabel} → ${r.toLabel} (${r.successCount}/${r.totalAttempts} successful)`,
    );

  if (frequent.length === 0) return 'No route memory available.';
  return `Known routes: ${frequent.join('; ')}.`;
}

/**
 * Returns a one-line description suitable for the Guardian or Voice Companion
 * when the user is navigating to a known destination.
 */
export function describeKnownRoute(route: RouteMemoryEntry): string {
  const rate = getRouteSuccessRate(route);
  if (rate >= 80) {
    return `You have successfully walked from ${route.fromLabel} to ${route.toLabel} before. ${route.segmentCount} segment route.`;
  }
  if (rate >= 50) {
    return `You have tried this route before with mixed results. Take care.`;
  }
  return `This route has been attempted but not always completed. Proceed carefully.`;
}
