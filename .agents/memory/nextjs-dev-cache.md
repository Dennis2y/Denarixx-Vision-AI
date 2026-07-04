---
name: Next.js dev cache corruption
description: npm run build overwrites the .next dev cache; always clean before restarting dev.
---

**Rule:** Any time `npm run build` is run inside `denarixx/`, delete `denarixx/.next` and restart the "Start application" workflow before doing anything that requires the dev server.

**Why:** Next.js writes a production `.next` on build. The dev server (`next dev`) uses the same directory but expects dev-format artifacts. A prod-built `.next` causes the dev server to serve stale JS or fail silently.

**How to apply:** After every `npm run build`, run `rm -rf denarixx/.next` then call `restart_workflow("Start application")`.
