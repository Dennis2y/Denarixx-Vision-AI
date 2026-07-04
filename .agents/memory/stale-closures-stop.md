---
name: Stale closures in stopSession
description: Mutable accumulator values used at session stop must be refs, not state.
---

**Rule:** In `useVisionSession`, values accumulated over multiple frames (audioCount, peakUrgency, sessionStartTime) are stored in `useRef`, not `useState`, so `stopSession` can read the latest values without a stale closure.

**Why:** `stopSession` is a `useCallback` that captures its dependencies at creation time. If audioCount were in state, `stopSession` would always see the value from when it was last recreated. Refs are mutable and always current.

**How to apply:** Any per-frame accumulator that needs to be read at stop time → use a ref (`audioCountRef`, `peakUrgencyRef`, `startTimeRef`). State is fine for values only used in render.
