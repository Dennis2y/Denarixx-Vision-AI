/**
 * Sprint 8 — Long-Term Memory & Personal Context tests
 *
 * Tests longTermMemoryEngine, memoryPrivacyEngine, routeMemoryEngine.
 * All pure engines — no browser, no React, no async I/O.
 *
 * Run: npx tsx tests/longTermMemory.test.ts
 */

import {
  createLongTermMemoryStore,
  addMemoryEntry,
  getEntriesByCategory,
  recallRelevant,
  findEntryById,
  markEntryAccessed,
  confirmEntry,
  deleteEntry,
  deleteAllEntries,
  pruneExpiredEntries,
  saveGuidancePreference,
  buildMemoryContextSummary,
  buildGuardianMemoryContext,
  buildNavigationMemoryContext,
  exportMemoryPlaceholder,
} from '../src/engines/longTermMemoryEngine';

import {
  validateMemoryEntry,
  sanitizeText,
  canSaveLocation,
  canSaveEntryCategory,
  getPrivacyStatement,
  getPrivacyRulesList,
  getConsentRequirementExplanation,
} from '../src/engines/memoryPrivacyEngine';

import {
  createRouteMemoryStore,
  recordRouteAttempt,
  getFrequentRoutes,
  findRouteByDestination,
  findRouteById,
  getRouteSuccessRate,
  deleteRoute,
  deleteAllRoutes,
  buildRouteMemoryContext,
  describeKnownRoute,
} from '../src/engines/routeMemoryEngine';

import type { MemoryCategory } from '../src/types/longTermMemory';
import { MEMORY_PRIVACY_RULES, MEMORY_MAX_ENTRIES } from '../src/types/longTermMemory';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected)
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertIncludes(text: string, sub: string) {
  if (!text.includes(sub)) throw new Error(`Expected "${text}" to include "${sub}"`);
}
function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}
function assertNull(v: unknown) {
  if (v !== null) throw new Error(`Expected null, got ${JSON.stringify(v)}`);
}
function assertNotNull(v: unknown) {
  if (v == null) throw new Error('Expected non-null value');
}

function heading(title: string) { console.log(`\n── ${title}`); }

// ─── Section 1: Store creation ────────────────────────────────────────────────

heading('Section 1: Store creation');

test('createLongTermMemoryStore returns empty store', () => {
  const s = createLongTermMemoryStore();
  assertEqual(s.entries.length, 0);
  assertEqual(s.routes.length, 0);
  assertNull(s.preference);
});
test('store has createdAt and lastModified dates', () => {
  const s = createLongTermMemoryStore();
  assert(s.createdAt instanceof Date);
  assert(s.lastModified instanceof Date);
});

// ─── Section 2: addMemoryEntry ────────────────────────────────────────────────

heading('Section 2: addMemoryEntry');

test('adding entry increases count by 1', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: 'Front door' });
  assertEqual(s.entries.length, 1);
});
test('entry has expected fields', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Café', description: 'My café' });
  const e = s.entries[0]!;
  assertEqual(e.category, 'saved_place');
  assertEqual(e.label, 'Café');
  assert(e.isFuzzyLocation); // always fuzzy
  assert(e.id.length > 0);
  assert(e.accessCount === 1);
});
test('default confidence is uncertain', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'Wet floor', description: 'Slippery' });
  assertEqual(s.entries[0]!.confidence, 'uncertain');
});
test('explicit confidence is stored', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Park', description: 'Park', confidence: 'remembered' });
  assertEqual(s.entries[0]!.confidence, 'remembered');
});
test('label truncated at 200 chars', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'guidance_preference', label: 'x'.repeat(300), description: '' });
  assert(s.entries[0]!.label.length <= 200);
});
test('description truncated at 1000 chars', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'guidance_preference', label: 'A', description: 'y'.repeat(1200) });
  assert(s.entries[0]!.description.length <= 1000);
});
test('adding multiple entries', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'A', description: '' });
  s = addMemoryEntry(s, { category: 'saved_place', label: 'B', description: '' });
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'C', description: '' });
  assertEqual(s.entries.length, 3);
});
test('isFuzzyLocation defaults to true', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Shop', description: '' });
  assert(s.entries[0]!.isFuzzyLocation === true);
});
test('expiresAt is set based on category', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'Ice', description: '' });
  assertNotNull(s.entries[0]!.expiresAt);
});

// ─── Section 3: getEntriesByCategory ─────────────────────────────────────────

heading('Section 3: getEntriesByCategory');

test('filters by category correctly', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'Pothole', description: '' });
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Café', description: '' });
  const places = getEntriesByCategory(s, 'saved_place');
  assertEqual(places.length, 2);
  assert(places.every((e) => e.category === 'saved_place'));
});
test('returns empty array for unused category', () => {
  const s = createLongTermMemoryStore();
  assertEqual(getEntriesByCategory(s, 'common_route').length, 0);
});

// ─── Section 4: recallRelevant ────────────────────────────────────────────────

heading('Section 4: recallRelevant');

test('finds entry by label keyword', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Corner shop', description: '' });
  const results = recallRelevant(s, 'shop');
  assertEqual(results.length, 1);
  assertIncludes(results[0]!.label, 'shop');
});
test('finds entry by description keyword', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'A', description: 'slippery floor' });
  const results = recallRelevant(s, 'slippery');
  assertEqual(results.length, 1);
});
test('expired entries excluded from recall', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Old place', description: '' });
  // Manually expire it
  const id = s.entries[0]!.id;
  s = { ...s, entries: s.entries.map(e => e.id === id ? { ...e, confidence: 'expired' as const, expiresAt: new Date(0) } : e) };
  const results = recallRelevant(s, 'Old place');
  assertEqual(results.length, 0);
});
test('respects maxResults limit', () => {
  let s = createLongTermMemoryStore();
  for (let i = 0; i < 10; i++) {
    s = addMemoryEntry(s, { category: 'saved_place', label: `Place ${i}`, description: '' });
  }
  const results = recallRelevant(s, 'Place', 3);
  assert(results.length <= 3);
});
test('returns empty for no match', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const results = recallRelevant(s, 'xyznotfound');
  assertEqual(results.length, 0);
});

// ─── Section 5: findEntryById ─────────────────────────────────────────────────

heading('Section 5: findEntryById');

test('finds entry by id', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Shop', description: '' });
  const id = s.entries[0]!.id;
  const found = findEntryById(s, id);
  assertNotNull(found);
  assertEqual(found!.id, id);
});
test('returns null for unknown id', () => {
  const s = createLongTermMemoryStore();
  assertNull(findEntryById(s, 'nonexistent-id'));
});

// ─── Section 6: markEntryAccessed ─────────────────────────────────────────────

heading('Section 6: markEntryAccessed');

test('increments accessCount', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const id = s.entries[0]!.id;
  const before = s.entries[0]!.accessCount;
  s = markEntryAccessed(s, id);
  assertEqual(s.entries[0]!.accessCount, before + 1);
});
test('updates lastAccessedAt', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const id = s.entries[0]!.id;
  const before = s.entries[0]!.lastAccessedAt.getTime();
  s = markEntryAccessed(s, id);
  assert(s.entries[0]!.lastAccessedAt.getTime() >= before);
});

// ─── Section 7: confirmEntry ──────────────────────────────────────────────────

heading('Section 7: confirmEntry');

test('sets isUserConfirmed = true', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const id = s.entries[0]!.id;
  s = confirmEntry(s, id);
  assert(s.entries[0]!.isUserConfirmed);
});
test('sets confidence = user-confirmed', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const id = s.entries[0]!.id;
  s = confirmEntry(s, id);
  assertEqual(s.entries[0]!.confidence, 'user-confirmed');
});

// ─── Section 8: deleteEntry ───────────────────────────────────────────────────

heading('Section 8: deleteEntry');

test('removes entry by id', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const id = s.entries[0]!.id;
  s = deleteEntry(s, id);
  assertEqual(s.entries.length, 0);
});
test('other entries preserved', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'A', description: '' });
  s = addMemoryEntry(s, { category: 'saved_place', label: 'B', description: '' });
  const idA = s.entries[0]!.id;
  s = deleteEntry(s, idA);
  assertEqual(s.entries.length, 1);
  assertEqual(s.entries[0]!.label, 'B');
});

// ─── Section 9: deleteAllEntries ─────────────────────────────────────────────

heading('Section 9: deleteAllEntries');

test('clears all entries', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'A', description: '' });
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'B', description: '' });
  s = deleteAllEntries(s);
  assertEqual(s.entries.length, 0);
});
test('clears preference', () => {
  let s = createLongTermMemoryStore();
  s = saveGuidancePreference(s, { personality: 'companion', speechRate: 1, verbosity: 'standard' });
  s = deleteAllEntries(s);
  assertNull(s.preference);
});
test('clears routes', () => {
  let s = createLongTermMemoryStore();
  s = { ...s, routes: [{ id: '1', fromLabel: 'A', toLabel: 'B', segmentCount: 1, successCount: 1, totalAttempts: 1, lastUsed: new Date(), isFuzzy: true }] };
  s = deleteAllEntries(s);
  assertEqual(s.routes.length, 0);
});

// ─── Section 10: pruneExpiredEntries ─────────────────────────────────────────

heading('Section 10: pruneExpiredEntries');

test('marks expired entries as expired confidence', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Old place', description: '' });
  const id = s.entries[0]!.id;
  // Set expiry in the past
  s = { ...s, entries: s.entries.map(e => e.id === id ? { ...e, expiresAt: new Date(Date.now() - 1000) } : e) };
  s = pruneExpiredEntries(s);
  assertEqual(s.entries[0]!.confidence, 'expired');
});
test('non-expired entries unchanged', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'New place', description: '' });
  const before = s.entries[0]!.confidence;
  s = pruneExpiredEntries(s);
  assertEqual(s.entries[0]!.confidence, before);
});

// ─── Section 11: saveGuidancePreference ──────────────────────────────────────

heading('Section 11: saveGuidancePreference');

test('stores preference', () => {
  let s = createLongTermMemoryStore();
  s = saveGuidancePreference(s, { personality: 'companion', speechRate: 1.2, verbosity: 'full' });
  assertNotNull(s.preference);
  assertEqual(s.preference!.personality, 'companion');
  assertEqual(s.preference!.speechRate, 1.2);
});
test('overwrites previous preference', () => {
  let s = createLongTermMemoryStore();
  s = saveGuidancePreference(s, { personality: 'minimal', speechRate: 1, verbosity: 'minimal' });
  s = saveGuidancePreference(s, { personality: 'balanced', speechRate: 1, verbosity: 'standard' });
  assertEqual(s.preference!.personality, 'balanced');
});

// ─── Section 12: buildMemoryContextSummary ────────────────────────────────────

heading('Section 12: buildMemoryContextSummary');

test('savedPlaces reflects saved_place entries', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Café', description: '' });
  const ctx = buildMemoryContextSummary(s);
  assertEqual(ctx.savedPlaces.length, 2);
  assert(ctx.savedPlaces.includes('Home'));
});
test('repeatedHazards reflects repeated_hazard entries', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'Wet floor', description: '' });
  const ctx = buildMemoryContextSummary(s);
  assertEqual(ctx.repeatedHazards.length, 1);
});
test('preferredPersonality from preference', () => {
  let s = createLongTermMemoryStore();
  s = saveGuidancePreference(s, { personality: 'detailed', speechRate: 1, verbosity: 'standard' });
  const ctx = buildMemoryContextSummary(s);
  assertEqual(ctx.preferredPersonality, 'detailed');
});
test('preferredPersonality null when no preference', () => {
  const s = createLongTermMemoryStore();
  const ctx = buildMemoryContextSummary(s);
  assertNull(ctx.preferredPersonality);
});
test('expired entries excluded from summary', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Expired', description: '' });
  const id = s.entries[0]!.id;
  s = { ...s, entries: s.entries.map(e => e.id === id ? { ...e, confidence: 'expired' as const } : e) };
  const ctx = buildMemoryContextSummary(s);
  assertEqual(ctx.savedPlaces.length, 0);
});
test('totalEntries counts only non-expired', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'A', description: '' });
  s = addMemoryEntry(s, { category: 'saved_place', label: 'B', description: '' });
  const id = s.entries[0]!.id;
  s = { ...s, entries: s.entries.map(e => e.id === id ? { ...e, confidence: 'expired' as const } : e) };
  const ctx = buildMemoryContextSummary(s);
  assertEqual(ctx.totalEntries, 1);
});

// ─── Section 13: buildGuardianMemoryContext ───────────────────────────────────

heading('Section 13: buildGuardianMemoryContext');

test('no entries → no prior memory message', () => {
  const s = createLongTermMemoryStore();
  assertIncludes(buildGuardianMemoryContext(s), 'No prior memory');
});
test('hazard → includes hazard in context', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'repeated_hazard', label: 'Pothole', description: '' });
  const ctx = buildGuardianMemoryContext(s);
  assertIncludes(ctx, 'Pothole');
});
test('saved place → included in context', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Home', description: '' });
  const ctx = buildGuardianMemoryContext(s);
  assertIncludes(ctx, 'Home');
});

// ─── Section 14: buildNavigationMemoryContext ─────────────────────────────────

heading('Section 14: buildNavigationMemoryContext');

test('no routes → no saved routes message', () => {
  const s = createLongTermMemoryStore();
  assertIncludes(buildNavigationMemoryContext(s), 'No saved routes');
});
test('route in store → included in context', () => {
  let s = createLongTermMemoryStore();
  s = { ...s, routes: [{ id: '1', fromLabel: 'Home', toLabel: 'Park', segmentCount: 2, successCount: 3, totalAttempts: 3, lastUsed: new Date(), isFuzzy: true }] };
  const ctx = buildNavigationMemoryContext(s);
  assertIncludes(ctx, 'Home');
  assertIncludes(ctx, 'Park');
});

// ─── Section 15: exportMemoryPlaceholder ─────────────────────────────────────

heading('Section 15: exportMemoryPlaceholder');

test('export includes entry count', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'A', description: '' });
  const exp = exportMemoryPlaceholder(s);
  assertEqual(exp.entryCount, 1);
});
test('export entries include id, category, label', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'MyPlace', description: 'Desc' });
  const exp = exportMemoryPlaceholder(s);
  assertEqual(exp.entries[0]!.label, 'MyPlace');
  assertEqual(exp.entries[0]!.category, 'saved_place');
});
test('export message mentions placeholder', () => {
  const s = createLongTermMemoryStore();
  assertIncludes(exportMemoryPlaceholder(s).message, 'placeholder');
});
test('export privacyNote is non-empty', () => {
  const s = createLongTermMemoryStore();
  assert(exportMemoryPlaceholder(s).privacyNote.length > 0);
});
test('expired entries excluded from export', () => {
  let s = createLongTermMemoryStore();
  s = addMemoryEntry(s, { category: 'saved_place', label: 'Old', description: '' });
  const id = s.entries[0]!.id;
  s = { ...s, entries: s.entries.map(e => e.id === id ? { ...e, confidence: 'expired' as const } : e) };
  const exp = exportMemoryPlaceholder(s);
  assertEqual(exp.entryCount, 0);
});

// ─── Section 16: MemoryPrivacyEngine — validateMemoryEntry ────────────────────

heading('Section 16: memoryPrivacyEngine — validateMemoryEntry');

test('valid entry without consent for non-location category', () => {
  const r = validateMemoryEntry('Wet floor', 'Slippery surface', 'repeated_hazard', false);
  assert(r.valid);
  assertNull(r.reason);
});
test('location entry without consent → invalid', () => {
  const r = validateMemoryEntry('Corner shop', 'My usual shop', 'saved_place', false);
  assert(!r.valid);
  assertIncludes(r.reason!, 'consent');
});
test('location entry with consent → valid', () => {
  const r = validateMemoryEntry('Corner shop', 'My usual shop', 'saved_place', true);
  assert(r.valid);
});
test('precise coordinate in label → invalid', () => {
  const r = validateMemoryEntry('51.507400, -0.127800 location', 'Some place', 'saved_place', true);
  assert(!r.valid);
  assertIncludes(r.reason!, 'sensitive');
});
test('face recognition in description → invalid', () => {
  const r = validateMemoryEntry('Area', 'face recognition enabled here', 'guidance_preference', true);
  assert(!r.valid);
});
test('biometric in description → invalid', () => {
  const r = validateMemoryEntry('Area', 'biometric checkpoint here', 'guidance_preference', false);
  assert(!r.valid);
});
test('common_route requires consent', () => {
  const r = validateMemoryEntry('Route', 'Home to shop', 'common_route', false);
  assert(!r.valid);
  assertIncludes(r.reason!, 'consent');
});
test('guidance_preference does not require consent', () => {
  const r = validateMemoryEntry('Pref', 'minimal style', 'guidance_preference', false);
  assert(r.valid);
});
test('repeated_hazard does not require consent', () => {
  const r = validateMemoryEntry('Pothole', 'Crack in road', 'repeated_hazard', false);
  assert(r.valid);
});

// ─── Section 17: memoryPrivacyEngine — sanitizeText ──────────────────────────

heading('Section 17: memoryPrivacyEngine — sanitizeText');

test('sanitizeText removes precise lat,lon pair', () => {
  const result = sanitizeText('My location is 51.507400,-0.127800 area');
  assert(!result.includes('51.507400'));
  assertIncludes(result, 'omitted');
});
test('sanitizeText preserves normal text', () => {
  const result = sanitizeText('Corner shop near the park');
  assertIncludes(result, 'Corner shop near the park');
});

// ─── Section 18: memoryPrivacyEngine — consent helpers ───────────────────────

heading('Section 18: memoryPrivacyEngine — consent helpers');

test('canSaveLocation(false) = false', () => assert(!canSaveLocation(false)));
test('canSaveLocation(true) = true', () => assert(canSaveLocation(true)));
test('canSaveEntryCategory(saved_place, false) = false', () => assert(!canSaveEntryCategory('saved_place', false)));
test('canSaveEntryCategory(saved_place, true) = true', () => assert(canSaveEntryCategory('saved_place', true)));
test('canSaveEntryCategory(repeated_hazard, false) = true', () => assert(canSaveEntryCategory('repeated_hazard', false)));
test('canSaveEntryCategory(guidance_preference, false) = true', () => assert(canSaveEntryCategory('guidance_preference', false)));
test('canSaveEntryCategory(navigation_session, false) = true', () => assert(canSaveEntryCategory('navigation_session', false)));

// ─── Section 19: memoryPrivacyEngine — info helpers ──────────────────────────

heading('Section 19: memoryPrivacyEngine — info helpers');

test('getPrivacyStatement returns non-empty string', () => assert(getPrivacyStatement().length > 0));
test('getPrivacyRulesList returns array of strings', () => {
  const rules = getPrivacyRulesList();
  assert(Array.isArray(rules));
  assert(rules.length >= 4);
  assert(rules.every(r => typeof r === 'string' && r.length > 0));
});
test('getPrivacyRulesList includes no face recognition', () => {
  assert(getPrivacyRulesList().some(r => r.toLowerCase().includes('face')));
});
test('getConsentRequirementExplanation for saved_place is non-null', () => {
  assertNotNull(getConsentRequirementExplanation('saved_place'));
});
test('getConsentRequirementExplanation for guidance_preference is null', () => {
  assertNull(getConsentRequirementExplanation('guidance_preference'));
});

// ─── Section 20: MemoryPrivacyEngine — MEMORY_PRIVACY_RULES constants ─────────

heading('Section 20: MEMORY_PRIVACY_RULES constants');

test('noPreciseLocation = true', () => assert(MEMORY_PRIVACY_RULES.noPreciseLocation));
test('noFaceRecognition = true', () => assert(MEMORY_PRIVACY_RULES.noFaceRecognition));
test('noBiometricMemory = true', () => assert(MEMORY_PRIVACY_RULES.noBiometricMemory));
test('userCanDelete = true', () => assert(MEMORY_PRIVACY_RULES.userCanDelete));
test('userCanExport = true', () => assert(MEMORY_PRIVACY_RULES.userCanExport));
test('exportIsPlaceholder = true', () => assert(MEMORY_PRIVACY_RULES.exportIsPlaceholder));

// ─── Section 21: RouteMemoryEngine — recordRouteAttempt ──────────────────────

heading('Section 21: routeMemoryEngine — recordRouteAttempt');

test('first attempt creates entry', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  assertEqual(routes.length, 1);
  assertEqual(routes[0]!.fromLabel, 'Home');
  assertEqual(routes[0]!.toLabel, 'Park');
  assertEqual(routes[0]!.totalAttempts, 1);
  assertEqual(routes[0]!.successCount, 1);
});
test('success = false increments attempts but not successCount', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', false);
  assertEqual(routes[0]!.successCount, 0);
  assertEqual(routes[0]!.totalAttempts, 1);
});
test('second attempt updates existing entry', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  assertEqual(routes.length, 1);
  assertEqual(routes[0]!.totalAttempts, 2);
  assertEqual(routes[0]!.successCount, 2);
});
test('different destination creates new entry', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  routes = recordRouteAttempt(routes, 'Home', 'Shop', true);
  assertEqual(routes.length, 2);
});
test('isFuzzy always true', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  assert(routes[0]!.isFuzzy === true);
});

// ─── Section 22: RouteMemoryEngine — getFrequentRoutes ───────────────────────

heading('Section 22: routeMemoryEngine — getFrequentRoutes');

test('returns routes with enough successes', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  routes = recordRouteAttempt(routes, 'Home', 'Shop', true);
  const frequent = getFrequentRoutes(routes, 2);
  assertEqual(frequent.length, 1);
  assertEqual(frequent[0]!.toLabel, 'Park');
});
test('returns empty when none meet threshold', () => {
  const routes = createRouteMemoryStore();
  const frequent = getFrequentRoutes(routes, 5);
  assertEqual(frequent.length, 0);
});

// ─── Section 23: RouteMemoryEngine — findRouteByDestination ──────────────────

heading('Section 23: routeMemoryEngine — findRouteByDestination');

test('finds route by partial destination label', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Corner shop', true);
  const found = findRouteByDestination(routes, 'shop');
  assertNotNull(found);
  assertIncludes(found!.toLabel, 'shop');
});
test('returns null for unknown destination', () => {
  const routes = createRouteMemoryStore();
  assertNull(findRouteByDestination(routes, 'unknown destination'));
});

// ─── Section 24: RouteMemoryEngine — getRouteSuccessRate ─────────────────────

heading('Section 24: routeMemoryEngine — getRouteSuccessRate');

test('100% success rate', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  assertEqual(getRouteSuccessRate(routes[0]!), 100);
});
test('50% success rate', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  routes = recordRouteAttempt(routes, 'A', 'B', false);
  assertEqual(getRouteSuccessRate(routes[0]!), 50);
});
test('0 attempts = 0 rate', () => {
  const route = { id: 'x', fromLabel: 'A', toLabel: 'B', segmentCount: 1, successCount: 0, totalAttempts: 0, lastUsed: new Date(), isFuzzy: true as const };
  assertEqual(getRouteSuccessRate(route), 0);
});

// ─── Section 25: RouteMemoryEngine — delete ───────────────────────────────────

heading('Section 25: routeMemoryEngine — delete');

test('deleteRoute removes by id', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  const id = routes[0]!.id;
  routes = deleteRoute(routes, id);
  assertEqual(routes.length, 0);
});
test('deleteAllRoutes returns empty array', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  routes = deleteAllRoutes();
  assertEqual(routes.length, 0);
});

// ─── Section 26: RouteMemoryEngine — buildRouteMemoryContext ──────────────────

heading('Section 26: routeMemoryEngine — buildRouteMemoryContext');

test('empty routes → no route memory message', () => {
  const routes = createRouteMemoryStore();
  assertIncludes(buildRouteMemoryContext(routes), 'No route memory');
});
test('routes included in context', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'Home', 'Park', true);
  const ctx = buildRouteMemoryContext(routes);
  assertIncludes(ctx, 'Home');
  assertIncludes(ctx, 'Park');
});

// ─── Section 27: RouteMemoryEngine — describeKnownRoute ──────────────────────

heading('Section 27: routeMemoryEngine — describeKnownRoute');

test('high success rate → positive description', () => {
  const route = { id: 'x', fromLabel: 'Home', toLabel: 'Park', segmentCount: 2, successCount: 9, totalAttempts: 10, lastUsed: new Date(), isFuzzy: true as const };
  assertIncludes(describeKnownRoute(route), 'successfully');
});
test('medium success rate → mixed results description', () => {
  const route = { id: 'x', fromLabel: 'Home', toLabel: 'Park', segmentCount: 2, successCount: 1, totalAttempts: 2, lastUsed: new Date(), isFuzzy: true as const };
  assertIncludes(describeKnownRoute(route), 'mixed');
});
test('low success rate → careful description', () => {
  const route = { id: 'x', fromLabel: 'Home', toLabel: 'Park', segmentCount: 2, successCount: 1, totalAttempts: 5, lastUsed: new Date(), isFuzzy: true as const };
  assertIncludes(describeKnownRoute(route), 'carefully');
});

// ─── Section 28: MEMORY_MAX_ENTRIES constant ──────────────────────────────────

heading('Section 28: MEMORY_MAX_ENTRIES');

test('MEMORY_MAX_ENTRIES is 200', () => assertEqual(MEMORY_MAX_ENTRIES, 200));

// ─── Section 29: findRouteById ────────────────────────────────────────────────

heading('Section 29: findRouteById');

test('finds route by id', () => {
  let routes = createRouteMemoryStore();
  routes = recordRouteAttempt(routes, 'A', 'B', true);
  const id = routes[0]!.id;
  const found = findRouteById(routes, id);
  assertNotNull(found);
  assertEqual(found!.id, id);
});
test('returns null for unknown id', () => {
  const routes = createRouteMemoryStore();
  assertNull(findRouteById(routes, 'nope'));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n\nSprint 8 Long-Term Memory: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
