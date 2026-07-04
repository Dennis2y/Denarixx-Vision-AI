---
name: Alert Throttle Design
description: Why AlertThrottleEngine is wired in useVisionSession rather than CognitiveGuardianEngine, and the per-severity rules.
---

## The rule
`AlertThrottleEngine` is instantiated as a ref in `useVisionSession`, not inside `CognitiveGuardianEngine`.

**Why:** CognitiveGuardianEngine has existing tests that check `shouldAlert` values. Embedding throttle there would make `shouldAlert` false on repeat calls (correct behavior) but would break tests that call `process()` repeatedly on the same guardian instance without resetting. Keeping throttle in the hook avoids all test disruption while still being the right call point — the hook is where `speak()` is called.

**How to apply:**
- Call `alertThrottleRef.current.shouldSpeak({hazardType, severity, confidence, message})` BEFORE `speak()`
- If `shouldSpeak: false` → call `addLog('[quiet] ...')` and increment `silencedAlerts`, do NOT call `speak()`
- If `shouldSpeak: true` → speak, then call `alertThrottleRef.current.record(...)` AFTER speaking
- Call `alertThrottleRef.current.reset()` in `startSession()` to clear cooldowns for each new session

## Cooldown rules
- `critical` → 5s (life-safety — always speaks, but tracked to avoid instant re-queue on same tick)
- `high` → 15s, override if confidence improves by >12%
- `medium` → 30s, no override
- `low` → 30s, no override

## Scene deduplication
`prevSceneSummaryRef` tracks the last scene summary. If same → log `[scene] Unchanged · ...` and skip `speak()` for scene narration.

## Log entry format (for AudioLog styling)
- `ALERT [urgency]:` → amber, ⚠ icon
- `[quiet]` → gray/italic, 🔇 icon  
- `[scene]` → dim blue, 🔁 icon
- `Memory recall:` → purple, 💾 icon
- `Error:` → red, ✗ icon
