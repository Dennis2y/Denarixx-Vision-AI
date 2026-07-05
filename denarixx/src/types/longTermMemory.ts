/**
 * Long-Term Memory types (Sprint 8)
 *
 * Types for LongTermMemoryEngine, MemoryPrivacyEngine, and RouteMemoryEngine.
 * Separate from V1 MemoryItem (src/types/index.ts) — do not merge.
 */

// ─── Confidence ───────────────────────────────────────────────────────────────

/** How reliably the system knows this fact. */
export type MemoryConfidence =
  | 'remembered'      // System observed it at least once
  | 'uncertain'       // Seen once or low confidence
  | 'expired'         // Past its expiry date; may no longer be accurate
  | 'user-confirmed'; // User explicitly confirmed this is correct

// ─── Category ─────────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'saved_place'         // A place the user explicitly saved
  | 'common_route'        // A route the user walks repeatedly
  | 'guidance_preference' // Preferred alert style / personality
  | 'repeated_hazard'     // A hazard that keeps appearing in the same area
  | 'frequent_landmark'   // A landmark encountered often
  | 'navigation_session'; // Summary of a past navigation session

// ─── Core entry ───────────────────────────────────────────────────────────────

export interface LongTermMemoryEntry {
  id: string;
  category: MemoryCategory;
  label: string;
  description: string;
  confidence: MemoryConfidence;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  /** Null = never expires. */
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  isUserConfirmed: boolean;
  /**
   * True = only a general area tag is stored (e.g. "near café"), not precise coords.
   * Sprint 8 always sets this true for place-related entries.
   */
  isFuzzyLocation: boolean;
}

// ─── Route memory ─────────────────────────────────────────────────────────────

export interface RouteMemoryEntry {
  id: string;
  fromLabel: string;
  toLabel: string;
  segmentCount: number;
  successCount: number;
  totalAttempts: number;
  lastUsed: Date;
  /** Always true — no precise GPS coordinates stored. */
  readonly isFuzzy: true;
}

// ─── Guidance preference ──────────────────────────────────────────────────────

export interface GuidancePreferenceMemory {
  personality: 'minimal' | 'balanced' | 'detailed' | 'companion';
  speechRate: number;
  verbosity: 'minimal' | 'standard' | 'full';
  lastUpdated: Date;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface LongTermMemoryStore {
  entries: LongTermMemoryEntry[];
  routes: RouteMemoryEntry[];
  preference: GuidancePreferenceMemory | null;
  createdAt: Date;
  lastModified: Date;
}

// ─── Export placeholder ───────────────────────────────────────────────────────

export interface MemoryExportPlaceholder {
  exportedAt: Date;
  entryCount: number;
  routeCount: number;
  message: string;
  privacyNote: string;
  /** Actual entry data included in placeholder export. */
  entries: Array<{
    id: string;
    category: MemoryCategory;
    label: string;
    description: string;
    confidence: MemoryConfidence;
    createdAt: Date;
  }>;
}

// ─── Context summary (used by Guardian / Navigation) ─────────────────────────

export interface MemoryContextSummary {
  savedPlaces: string[];
  repeatedHazards: string[];
  preferredPersonality: string | null;
  recentRouteCount: number;
  frequentLandmarks: string[];
  totalEntries: number;
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

export const MEMORY_PRIVACY_RULES = {
  noPreciseLocation: true,
  noFaceRecognition: true,
  noBiometricMemory: true,
  userCanDelete: true,
  userCanExport: true,
  exportIsPlaceholder: true,
} as const;

/** Days until a memory entry expires and is marked 'expired'. */
export const MEMORY_EXPIRY_DAYS: Record<MemoryCategory, number> = {
  saved_place: 365,
  common_route: 90,
  guidance_preference: 730,
  repeated_hazard: 30,
  frequent_landmark: 180,
  navigation_session: 7,
};

export const MEMORY_MAX_ENTRIES = 200;

export const MEMORY_PRIVACY_STATEMENT =
  'All memory is stored in this session only. ' +
  'No precise location coordinates are saved. ' +
  'No face recognition or biometric data is stored. ' +
  'You can delete all memory at any time.';
