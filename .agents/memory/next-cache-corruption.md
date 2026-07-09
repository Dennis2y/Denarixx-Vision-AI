---
name: Next.js .next cache corruption
description: Recurring issue — stale .next chunks cause 500 errors after any prior build. Fix is rm -rf denarixx/.next then restart workflow.
---

# Next.js .next cache corruption

## Rule
Whenever the "Start application" workflow shows 500 errors with `Cannot find module './NNNN.js'` or `ENOENT: routes-manifest.json`, the `.next` directory is corrupted by a prior production build leaving stale chunk references.

**Fix (always the same two steps):**
```
rm -rf denarixx/.next
# then restart "Start application" workflow
```

**Why:** Running `npm run build` leaves chunk files in `.next/server/`. When the dev server restarts it re-compiles with new chunk IDs, but the old `webpack-runtime.js` still references the old IDs → MODULE_NOT_FOUND.

**How to apply:** Any time the user reports "Internal Server Error" or the logs show the `Cannot find module './NNNN.js'` pattern, run the two steps above without further investigation — it is always this cause.

**How to prevent:** After every production build, always delete `.next` before restarting dev: `rm -rf denarixx/.next && restart_workflow "Start application"`.
