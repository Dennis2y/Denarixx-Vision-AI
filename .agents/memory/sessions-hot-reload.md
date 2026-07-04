---
name: Session store hot-reload race
description: In-memory session store resets on Next.js module hot-reload during dev; not a bug.
---

**Rule:** `POST /api/sessions/end` returning 404 in dev during parallel page compilations is expected behavior, not a route bug.

**Why:** The session store is an in-process `Map` in `src/lib/sessionStore.ts`. Next.js hot-reloads this module when it recompiles a page, clearing the Map. A session created before the reload no longer exists after it.

**How to apply:** Test sessions/end in isolation (start → immediately end, no concurrent compilation). The route is correct. This is a Phase 1 limitation documented in the docs page. Phase 2 will use Postgres via Prisma for persistence.
