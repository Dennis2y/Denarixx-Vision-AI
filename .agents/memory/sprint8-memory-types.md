---
name: Sprint 8 memory types separation
description: LongTermMemory types live in longTermMemory.ts, separate from V1 MemoryItem in index.ts. Never merge them.
---

## Rule

`src/types/longTermMemory.ts` is the Sprint 8 type file. `src/types/index.ts` owns the V1 `MemoryItem`. Never merge these two files.

**Why:** V1 `MemoryItem` is used throughout the existing API routes and `MemoryEngine.ts`. Sprint 8 types use a different shape (`LongTermMemoryEntry`, `RouteMemoryEntry`, etc.) that would cause type conflicts if merged.

**How to apply:** Always import Sprint 8 types from `@/types/longTermMemory`, V1 types from `@/types`. The Sprint 8 engines (`longTermMemoryEngine`, `memoryPrivacyEngine`, `routeMemoryEngine`) are pure functional and operate on `LongTermMemoryStore`, never on `MemoryItem`.

## Architecture decisions added in Sprint 8

- `LongTermMemoryStore` is a client-side in-memory store (React state in Phase 1). Not persisted to server.
- `RouteMemoryEntry.isFuzzy` is always `true` — enforced in the type as a literal.
- `MemoryEngine.clearAll()` delegates to `InMemoryStore.clearAll()` (Map.clear()).
- `DELETE /api/memory` clears V1 store only. Sprint 8 store is client-side and cleared in React state.
- Memory page exports a placeholder JSON — persistent export is Phase 2.
