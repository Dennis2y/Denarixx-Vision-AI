---
name: Network event hook order in useVisionSession
description: Pattern for subscribing to browser online/offline events safely inside a React hook that also uses useCallback functions.
---

## Rule
When adding `window` online/offline event handlers inside a `useEffect` in `useVisionSession.ts`, you must:
1. Declare `speakCoordinatedRef` and `addLogRef` as `useRef` with **no-op initializers** (`() => false`, `() => {}`)
2. Place the sync effects (`speakCoordinatedRef.current = speakCoordinated`) **after** the `speakCoordinated` and `addLog` useCallback declarations
3. The network `useEffect` (with empty deps `[]`) uses `speakCoordinatedRef.current(...)` and `addLogRef.current(...)`, never the functions directly

**Why:** TypeScript flags `const` variables used inside a `useEffect` body before their declaration line as TS2448 "used before declaration". Even though React guarantees useEffect runs after render (so the values exist), TypeScript's static analysis doesn't model this. The no-op ref pattern sidesteps the error cleanly.

**How to apply:** Whenever adding any new stable-ref pattern for functions declared later in the same hook, initialize the ref with a no-op and add a sync effect after the real declaration.
