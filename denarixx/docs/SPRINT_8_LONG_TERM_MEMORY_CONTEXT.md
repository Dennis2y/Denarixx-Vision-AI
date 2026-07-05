# Sprint 8 — Long-Term Memory & Personal Context

## Goal

Make Denarixx Vision AI remember useful context safely over time — saved places,
common routes, preferred guidance style, and repeated hazards — while enforcing
strict privacy rules the user can audit and control.

---

## New in Sprint 8

### Types (`src/types/longTermMemory.ts`)

| Type | Purpose |
|------|---------|
| `MemoryConfidence` | `remembered` \| `uncertain` \| `expired` \| `user-confirmed` |
| `MemoryCategory` | `saved_place` \| `common_route` \| `guidance_preference` \| `repeated_hazard` \| `frequent_landmark` \| `navigation_session` |
| `LongTermMemoryEntry` | Core memory entry with id, category, confidence, fuzzy location flag |
| `RouteMemoryEntry` | Route from/to with success count; `isFuzzy: true` always |
| `GuidancePreferenceMemory` | Personality, speech rate, verbosity |
| `LongTermMemoryStore` | Full store: entries + routes + preference |
| `MemoryExportPlaceholder` | Phase 1 export with privacy note |
| `MemoryContextSummary` | Summary for Guardian/Navigation context injection |

### LongTermMemoryEngine (`src/engines/longTermMemoryEngine.ts`)

Pure functional — all functions take and return `LongTermMemoryStore`.

| Function | Purpose |
|----------|---------|
| `createLongTermMemoryStore()` | Empty store |
| `addMemoryEntry(store, input)` | Add entry; evicts oldest non-confirmed if at cap (200) |
| `getEntriesByCategory(store, cat)` | Filter by category |
| `recallRelevant(store, query, max)` | Fuzzy label/description search, excludes expired |
| `findEntryById(store, id)` | Exact id lookup |
| `markEntryAccessed(store, id)` | Increments accessCount, updates lastAccessedAt |
| `confirmEntry(store, id)` | Sets `isUserConfirmed: true`, confidence `user-confirmed` |
| `deleteEntry(store, id)` | Remove single entry |
| `deleteAllEntries(store)` | Clear everything including routes and preference |
| `pruneExpiredEntries(store)` | Mark past-expiry entries as `expired` confidence |
| `saveGuidancePreference(store, pref)` | Store/update personality preference |
| `buildMemoryContextSummary(store)` | `MemoryContextSummary` for system integration |
| `buildGuardianMemoryContext(store)` | One-line string for Cognitive Guardian |
| `buildNavigationMemoryContext(store)` | One-line string for Navigation Engine |
| `exportMemoryPlaceholder(store)` | Phase 1 placeholder export |

### MemoryPrivacyEngine (`src/engines/memoryPrivacyEngine.ts`)

| Function | Purpose |
|----------|---------|
| `validateMemoryEntry(label, desc, cat, consent)` | Blocks precise coords, biometric, face data; requires consent for location categories |
| `sanitizeText(text)` | Strips coordinate patterns from text |
| `canSaveLocation(consent)` | Boolean consent check |
| `canSaveEntryCategory(cat, consent)` | Category-specific consent check |
| `getPrivacyStatement()` | Full privacy statement string |
| `getPrivacyRulesList()` | Array of human-readable privacy rules |
| `getConsentRequirementExplanation(cat)` | Per-category consent explanation or null |

### RouteMemoryEngine (`src/engines/routeMemoryEngine.ts`)

| Function | Purpose |
|----------|---------|
| `createRouteMemoryStore()` | Empty routes array |
| `recordRouteAttempt(routes, from, to, success)` | Upsert route with attempt/success tracking |
| `getFrequentRoutes(routes, minSuccesses)` | Filter + sort by success count |
| `findRouteByDestination(routes, label)` | Partial label search |
| `findRouteById(routes, id)` | Exact id lookup |
| `getRouteSuccessRate(route)` | Percentage 0–100 |
| `deleteRoute(routes, id)` | Remove single route |
| `deleteAllRoutes()` | Return empty array |
| `buildRouteMemoryContext(routes)` | One-line string for Navigation Engine |
| `describeKnownRoute(route)` | Human-readable route familiarity description |

---

## Privacy Rules

### Invariants (never overridden)

1. **No precise GPS coordinates** — entries with coordinate patterns (e.g. `51.5074, -0.1278`) are rejected by `validateMemoryEntry()`.
2. **No face recognition** — any description containing "face recognition" is rejected.
3. **No biometric memory** — fingerprint, retina, iris scan patterns are rejected.
4. **Location consent required** — `saved_place`, `common_route`, `frequent_landmark` entries require `locationConsentGiven === true`.
5. **User can delete all** — `deleteAllEntries()` clears entries, routes, and preference.
6. **Export is placeholder** — `exportMemoryPlaceholder()` produces an in-memory dump with a privacy note; persistent export is planned for Phase 2.

### Expiry schedule

| Category | Expires after |
|----------|--------------|
| saved_place | 365 days |
| common_route | 90 days |
| guidance_preference | 730 days |
| repeated_hazard | 30 days |
| frequent_landmark | 180 days |
| navigation_session | 7 days |

`pruneExpiredEntries()` sets confidence to `expired` (entries remain for audit).

---

## System Integration

### Cognitive Guardian
`buildGuardianMemoryContext(store)` returns a one-line string:
```
"Known hazards in this area: Wet floor. Familiar places nearby: Home. Preferred guidance style: companion."
```
The Guardian can inject this as context before deciding whether to speak.

### Navigation Engine
`buildNavigationMemoryContext(store)` returns known routes:
```
"Known routes: Home → Park (used 4 times); Home → Shop (used 2 times)."
```

### Voice Companion
The `save_this_place` voice command (Sprint 7) triggers `addMemoryEntry` with category `saved_place` — only after `locationConsentGiven === true` is verified by `voiceCommandRouterEngine.ts`.

### Settings
`saveGuidancePreference()` is called whenever the user changes personality in Settings, building a persistent preference record.

---

## Memory Page (`/memory`)

The Memory page now shows:
- **Saved places** — cards with fuzzy location tags
- **Route memories** — from/to with success rate badge
- **Repeated hazards** — sorted by encounter frequency
- **Guidance preference** — current personality setting
- **Delete all memory** — button with confirmation, clears everything
- **Privacy panel** — lists all privacy rules and consent status
- **Export placeholder** — downloads a JSON file with a privacy note

---

## Memory API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/memory` | GET | List all V1 memory items |
| `POST /api/memory/save` | POST | Save a V1 memory item |
| `DELETE /api/memory` | DELETE | Delete all V1 memory items |

Sprint 8 engines are pure — they operate on in-memory stores passed in from the caller.
A unified API layer that merges V1 and Sprint 8 stores is planned for Phase 2.

---

## Tests

`tests/longTermMemory.test.ts` — 29 sections, 110+ assertions:

1–2. Store creation and basic structure
3–5. addMemoryEntry (field validation, defaults, truncation, isFuzzyLocation)
6–8. getEntriesByCategory, recallRelevant, findEntryById
9–11. markEntryAccessed, confirmEntry, deleteEntry
12–13. deleteAllEntries, pruneExpiredEntries
14–15. saveGuidancePreference
16–17. buildMemoryContextSummary
18–19. buildGuardianMemoryContext, buildNavigationMemoryContext
20–21. exportMemoryPlaceholder
22–25. validateMemoryEntry (consent, blocked patterns, category rules)
26–27. sanitizeText, consent helpers
28. Privacy constants (MEMORY_PRIVACY_RULES)
29. MEMORY_MAX_ENTRIES = 200
30–35. RouteMemoryEngine (record, query, stats, delete, context, describe)
