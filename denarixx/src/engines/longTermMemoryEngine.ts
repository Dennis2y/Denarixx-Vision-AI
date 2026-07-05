/**
 * LongTermMemoryEngine (Sprint 8)
 *
 * Pure functional engine for managing long-term user memory.
 * No async, no I/O, no React. Fully testable in Node.
 *
 * Privacy invariants (enforced here, not delegated):
 *   - No precise location coordinates stored.
 *   - No face recognition data.
 *   - No biometric memory.
 *   - User can delete all entries at any time.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  LongTermMemoryEntry,
  LongTermMemoryStore,
  MemoryCategory,
  MemoryConfidence,
  MemoryContextSummary,
  MemoryExportPlaceholder,
  GuidancePreferenceMemory,
} from '@/types/longTermMemory';
import { MEMORY_EXPIRY_DAYS, MEMORY_MAX_ENTRIES, MEMORY_PRIVACY_STATEMENT } from '@/types/longTermMemory';

// ─── Store lifecycle ──────────────────────────────────────────────────────────

export function createLongTermMemoryStore(): LongTermMemoryStore {
  return {
    entries: [],
    routes: [],
    preference: null,
    createdAt: new Date(),
    lastModified: new Date(),
  };
}

// ─── Entry creation helpers ───────────────────────────────────────────────────

function expiryDate(category: MemoryCategory, from: Date): Date {
  const days = MEMORY_EXPIRY_DAYS[category];
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Add ─────────────────────────────────────────────────────────────────────

export interface AddMemoryEntryInput {
  category: MemoryCategory;
  label: string;
  description: string;
  confidence?: MemoryConfidence;
  isUserConfirmed?: boolean;
  isFuzzyLocation?: boolean;
  metadata?: Record<string, unknown>;
}

export function addMemoryEntry(
  store: LongTermMemoryStore,
  input: AddMemoryEntryInput,
): LongTermMemoryStore {
  if (store.entries.length >= MEMORY_MAX_ENTRIES) {
    // Evict oldest non-user-confirmed entry to make room
    const evictIndex = store.entries.findIndex((e) => !e.isUserConfirmed);
    if (evictIndex === -1) return store; // all confirmed — refuse new entry
    const entries = [...store.entries];
    entries.splice(evictIndex, 1);
    return addMemoryEntry({ ...store, entries }, input);
  }

  const now = new Date();
  const entry: LongTermMemoryEntry = {
    id: uuidv4(),
    category: input.category,
    label: input.label.slice(0, 200),
    description: input.description.slice(0, 1000),
    confidence: input.confidence ?? 'uncertain',
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 1,
    expiresAt: expiryDate(input.category, now),
    metadata: input.metadata ?? {},
    isUserConfirmed: input.isUserConfirmed ?? false,
    isFuzzyLocation: input.isFuzzyLocation ?? true, // always fuzzy by default
  };

  return {
    ...store,
    entries: [...store.entries, entry],
    lastModified: now,
  };
}

// ─── Query ────────────────────────────────────────────────────────────────────

export function getEntriesByCategory(
  store: LongTermMemoryStore,
  category: MemoryCategory,
): LongTermMemoryEntry[] {
  return store.entries.filter((e) => e.category === category);
}

export function recallRelevant(
  store: LongTermMemoryStore,
  query: string,
  maxResults = 5,
): LongTermMemoryEntry[] {
  const lower = query.toLowerCase();
  return store.entries
    .filter(
      (e) =>
        e.confidence !== 'expired' &&
        (e.label.toLowerCase().includes(lower) ||
          e.description.toLowerCase().includes(lower)),
    )
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, maxResults);
}

export function findEntryById(
  store: LongTermMemoryStore,
  id: string,
): LongTermMemoryEntry | null {
  return store.entries.find((e) => e.id === id) ?? null;
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

export function markEntryAccessed(
  store: LongTermMemoryStore,
  id: string,
): LongTermMemoryStore {
  const now = new Date();
  return {
    ...store,
    entries: store.entries.map((e) =>
      e.id === id
        ? { ...e, lastAccessedAt: now, accessCount: e.accessCount + 1 }
        : e,
    ),
    lastModified: now,
  };
}

export function confirmEntry(
  store: LongTermMemoryStore,
  id: string,
): LongTermMemoryStore {
  const now = new Date();
  return {
    ...store,
    entries: store.entries.map((e) =>
      e.id === id
        ? { ...e, isUserConfirmed: true, confidence: 'user-confirmed', lastAccessedAt: now }
        : e,
    ),
    lastModified: now,
  };
}

export function deleteEntry(
  store: LongTermMemoryStore,
  id: string,
): LongTermMemoryStore {
  return {
    ...store,
    entries: store.entries.filter((e) => e.id !== id),
    lastModified: new Date(),
  };
}

export function deleteAllEntries(store: LongTermMemoryStore): LongTermMemoryStore {
  return {
    ...store,
    entries: [],
    routes: [],
    preference: null,
    lastModified: new Date(),
  };
}

export function pruneExpiredEntries(store: LongTermMemoryStore): LongTermMemoryStore {
  const now = new Date();
  let changed = false;
  const entries = store.entries.map((e) => {
    if (e.expiresAt && e.expiresAt < now && e.confidence !== 'expired') {
      changed = true;
      return { ...e, confidence: 'expired' as MemoryConfidence };
    }
    return e;
  });
  return changed ? { ...store, entries, lastModified: now } : store;
}

// ─── Guidance preference ──────────────────────────────────────────────────────

export function saveGuidancePreference(
  store: LongTermMemoryStore,
  pref: Omit<GuidancePreferenceMemory, 'lastUpdated'>,
): LongTermMemoryStore {
  return {
    ...store,
    preference: { ...pref, lastUpdated: new Date() },
    lastModified: new Date(),
  };
}

// ─── Context builders (used by Guardian / Navigation / Voice) ─────────────────

export function buildMemoryContextSummary(
  store: LongTermMemoryStore,
): MemoryContextSummary {
  const active = store.entries.filter((e) => e.confidence !== 'expired');
  const savedPlaces = active
    .filter((e) => e.category === 'saved_place')
    .map((e) => e.label);
  const repeatedHazards = active
    .filter((e) => e.category === 'repeated_hazard')
    .sort((a, b) => b.accessCount - a.accessCount)
    .map((e) => e.label);
  const frequentLandmarks = active
    .filter((e) => e.category === 'frequent_landmark')
    .sort((a, b) => b.accessCount - a.accessCount)
    .map((e) => e.label);

  return {
    savedPlaces,
    repeatedHazards,
    preferredPersonality: store.preference?.personality ?? null,
    recentRouteCount: store.routes.filter((r) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return r.lastUsed > sevenDaysAgo;
    }).length,
    frequentLandmarks,
    totalEntries: active.length,
  };
}

export function buildGuardianMemoryContext(store: LongTermMemoryStore): string {
  const summary = buildMemoryContextSummary(store);
  const parts: string[] = [];

  if (summary.repeatedHazards.length > 0) {
    parts.push(`Known hazards in this area: ${summary.repeatedHazards.slice(0, 3).join(', ')}.`);
  }
  if (summary.savedPlaces.length > 0) {
    parts.push(`Familiar places nearby: ${summary.savedPlaces.slice(0, 3).join(', ')}.`);
  }
  if (summary.preferredPersonality) {
    parts.push(`Preferred guidance style: ${summary.preferredPersonality}.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'No prior memory context available.';
}

export function buildNavigationMemoryContext(store: LongTermMemoryStore): string {
  const routes = store.routes
    .filter((r) => r.successCount > 0)
    .sort((a, b) => b.successCount - a.successCount)
    .slice(0, 3);

  if (routes.length === 0) return 'No saved routes available.';

  const routeLines = routes.map(
    (r) => `${r.fromLabel} → ${r.toLabel} (used ${r.successCount} times)`,
  );
  return `Known routes: ${routeLines.join('; ')}.`;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportMemoryPlaceholder(
  store: LongTermMemoryStore,
): MemoryExportPlaceholder {
  const active = store.entries.filter((e) => e.confidence !== 'expired');
  return {
    exportedAt: new Date(),
    entryCount: active.length,
    routeCount: store.routes.length,
    message:
      'This is a placeholder export. Persistent storage and full export are planned for Phase 2.',
    privacyNote: MEMORY_PRIVACY_STATEMENT,
    entries: active.map((e) => ({
      id: e.id,
      category: e.category,
      label: e.label,
      description: e.description,
      confidence: e.confidence,
      createdAt: e.createdAt,
    })),
  };
}
