/**
 * MemoryPrivacyEngine (Sprint 8)
 *
 * Enforces privacy rules for all memory writes.
 * Pure engine — no async, no I/O.
 *
 * Invariants:
 *   - Precise GPS coordinates are never saved.
 *   - Face recognition data is never stored.
 *   - Biometric data is never stored.
 *   - Location data requires explicit user consent.
 *   - All entries are fuzzy by default.
 */

import type { MemoryCategory } from '@/types/longTermMemory';
import { MEMORY_PRIVACY_RULES, MEMORY_PRIVACY_STATEMENT } from '@/types/longTermMemory';

export { MEMORY_PRIVACY_RULES };

// ─── Blocked content patterns ─────────────────────────────────────────────────

const BLOCKED_PATTERNS: RegExp[] = [
  /\b\d{1,3}\.\d{4,}\b/,              // Precise decimal coordinates (e.g. 51.5074)
  /\b-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}\b/, // lat,lon pairs
  /face\s*recog/i,
  /biometric/i,
  /fingerprint/i,
  /retina/i,
  /iris\s*scan/i,
];

// ─── Validation ───────────────────────────────────────────────────────────────

export interface PrivacyValidationResult {
  valid: boolean;
  reason: string | null;
  /** Sanitized label safe to store. */
  safeLabel: string;
  /** Sanitized description safe to store. */
  safeDescription: string;
}

export function validateMemoryEntry(
  label: string,
  description: string,
  category: MemoryCategory,
  locationConsentGiven: boolean,
): PrivacyValidationResult {
  const combined = `${label} ${description}`;

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        valid: false,
        reason: 'Entry contains sensitive data (precise location, biometric, or face recognition) that cannot be stored.',
        safeLabel: label,
        safeDescription: description,
      };
    }
  }

  // Location consent required for place/route entries
  const requiresConsent: MemoryCategory[] = ['saved_place', 'common_route', 'frequent_landmark'];
  if (requiresConsent.includes(category) && !locationConsentGiven) {
    return {
      valid: false,
      reason: 'Location memory requires consent. Enable location memory in Settings.',
      safeLabel: label,
      safeDescription: description,
    };
  }

  return {
    valid: true,
    reason: null,
    safeLabel: sanitizeText(label),
    safeDescription: sanitizeText(description),
  };
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Strips any numeric patterns that look like precise GPS coordinates.
 * Replaces them with a fuzzy placeholder.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\b-?\d{1,3}\.\d{4,},?\s*-?\d{1,3}\.\d{4,}\b/g, '[location omitted]')
    .replace(/\b\d{1,3}\.\d{6,}\b/g, '[coordinate omitted]')
    .trim();
}

// ─── Consent guards ───────────────────────────────────────────────────────────

export function canSaveLocation(locationConsentGiven: boolean): boolean {
  return locationConsentGiven;
}

export function canSaveEntryCategory(
  category: MemoryCategory,
  locationConsentGiven: boolean,
): boolean {
  const requiresConsent: MemoryCategory[] = ['saved_place', 'common_route', 'frequent_landmark'];
  if (requiresConsent.includes(category)) return locationConsentGiven;
  return true; // other categories (hazard, preference, nav_session) don't need location consent
}

// ─── Privacy info ─────────────────────────────────────────────────────────────

export function getPrivacyStatement(): string {
  return MEMORY_PRIVACY_STATEMENT;
}

export function getPrivacyRulesList(): string[] {
  return [
    'No precise GPS coordinates are ever stored.',
    'No face recognition or biometric data is retained.',
    'Location memory requires your explicit consent.',
    'You can delete all memory at any time.',
    'Memory is session-only in Phase 1 — cleared on server restart.',
    'Export produces a placeholder; full export planned for Phase 2.',
  ];
}

/**
 * Returns a short human-readable explanation for why an entry category
 * requires consent, or null if no consent is needed.
 */
export function getConsentRequirementExplanation(category: MemoryCategory): string | null {
  switch (category) {
    case 'saved_place':
      return 'Saving a place records a general area tag. Location consent is required.';
    case 'common_route':
      return 'Route memory stores a general description, no GPS. Location consent is required.';
    case 'frequent_landmark':
      return 'Landmark memory records a name and description. Location consent is required.';
    default:
      return null;
  }
}
