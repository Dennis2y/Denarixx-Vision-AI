# Sprint 7 — Voice Companion & Hands-Free Control

## Goal

Make Denarixx Vision AI fully usable without touching the screen.
A blind user should be able to start a session, get hazard alerts, navigate to a saved place,
and trigger an emergency stop — all by voice, with no button presses required.

---

## New in Sprint 7

### New Voice Commands

| Say this                             | Action                               | Target system   |
|--------------------------------------|--------------------------------------|-----------------|
| "start navigation"                   | Open a navigation session            | Navigation      |
| "begin navigation"                   | Open a navigation session            | Navigation      |
| "start navigating"                   | Open a navigation session            | Navigation      |
| "navigate to …"                      | Open a navigation session            | Navigation      |
| "stop navigation"                    | End the current navigation session   | Navigation      |
| "end navigation"                     | End the current navigation session   | Navigation      |
| "stop navigating"                    | End the current navigation session   | Navigation      |
| "cancel navigation"                  | End the current navigation session   | Navigation      |

These add to the V5 command set. All V5 commands remain unchanged.

### Command Confirmation Engine (`voiceCommandConfirmationEngine.ts`)

Every executed command speaks a short confirmation. The text adapts to the active
guidance personality:

| Command              | minimal              | balanced                       | companion                              |
|----------------------|----------------------|--------------------------------|----------------------------------------|
| start vision         | "Starting vision."   | "Starting vision session."     | "Starting your vision session. I'm here with you." |
| stop vision          | "Stopping."          | "Stopping vision session."     | "Stopping your session. Stay safe."    |
| start navigation     | "Starting navigation." | "Starting navigation."       | "Let's go. Starting navigation — I'll guide you step by step." |
| stop navigation      | "Navigation stopped." | "Stopping navigation."        | "Navigation stopped. You can restart any time." |
| save this place      | "Place saved."       | "Place saved."                 | "I've saved this place to your memory." |
| emergency stop       | "Emergency stop."    | "Emergency stop. All activity halted." | "Emergency stop. I have halted everything." |
| repeat last (minimal)| *(silent)*           | "Repeating last guidance."     | "Of course. Repeating last guidance."  |

Minimal personality suppresses confirmations for low-value commands (repeat, describe,
where am I) to minimise speech noise. Emergency stop is **always** spoken.

### Voice Command Router (`voiceCommandRouterEngine.ts`)

Dispatches parsed commands to the correct system:

| Command              | Target system    | Action    | Priority  |
|----------------------|------------------|-----------|-----------|
| start_session        | vision_session   | start     | high      |
| stop_session         | vision_session   | stop      | high      |
| repeat_last          | guardian         | repeat    | normal    |
| describe_surroundings| vision_session   | describe  | normal    |
| where_am_i           | navigation       | locate    | normal    |
| what_should_i_do     | guardian         | advise    | normal    |
| save_this_place      | memory           | save      | normal    |
| start_navigation     | navigation       | start     | high      |
| stop_navigation      | navigation       | stop      | high      |
| emergency_stop       | emergency        | stop_all  | emergency |

### Voice Command Router Hook (`useVoiceCommandRouter.ts`)

Wires the full pipeline together in a single React hook:

```
Speech input
  → useVoiceCommands (V5 hook — Web Speech API + graceful fallback)
  → VoiceCommandEngine.parse() (command type + confidence)
  → routeVoiceCommand(context) (dispatch + safety checks)
  → speak confirmation (via onSpeak callback)
  → invoke handler callback (onStartSession, onStartNavigation, …)
```

Callers supply handler callbacks and current router state:

```typescript
const router = useVoiceCommandRouter(
  {
    sessionActive,
    navigationActive,
    locationConsentGiven,
    personality,
  },
  {
    onStartSession:       () => startSession(),
    onStopSession:        () => stopSession(),
    onRepeatLast:         () => repeatLast(),
    onDescribeSurroundings: () => requestDescription(),
    onWhereAmI:           () => requestLocation(),
    onWhatShouldIDo:      () => requestAdvice(),
    onSaveThisPlace:      () => saveCurrentPlace(),
    onStartNavigation:    () => openNavigation(),
    onStopNavigation:     () => endNavigation(),
    onEmergencyStop:      () => emergencyStop(),
    onSpeak:              (text, priority) => speak(text, priority),
    onDispatch:           (d) => logDispatch(d),
  },
);
```

---

## Safety Invariants

### 1 — Emergency stop always overrides everything

`emergency_stop` is never blocked. It fires regardless of session state,
navigation state, or any other context flag. Priority: `emergency`.

### 2 — No face recognition from voice commands

`no_face_recognition_enabled` is included in `safetyChecks` on every dispatch.
No voice command enables face recognition. This is verified in tests.

### 3 — No location stored without explicit intent

Only `save_this_place` writes location data. It requires `locationConsentGiven === true`
in the router context. Without consent it is blocked with a spoken explanation.
The `writesLocation()` helper returns `false` for all other commands, including when
`save_this_place` is blocked.

### 4 — Command ordering prevents swallowing

`start_navigation` and `stop_navigation` patterns are checked before the bare
`start`/`stop` patterns that exist for `start_session`/`stop_session`. This prevents
"start navigation" being incorrectly parsed as `start_session`.

---

## State Compatibility Guards

Commands check context before executing. Blocked commands speak a reason:

| Command              | Blocked when                         |
|----------------------|--------------------------------------|
| start_session        | Session already active               |
| stop_session         | No session active                    |
| describe_surroundings| No session active                    |
| repeat_last          | No session active                    |
| what_should_i_do     | No session active                    |
| start_navigation     | Navigation already active            |
| stop_navigation      | No navigation active                 |
| save_this_place      | locationConsentGiven === false       |

---

## Browser Support

Unchanged from V5:

| Browser | Speech Recognition | Fallback       |
|---------|--------------------|----------------|
| Chrome  | ✅ Full            | —              |
| Edge    | ✅ Full            | —              |
| Firefox | ❌ Not supported   | Silent mode    |
| Safari  | ⚠️ Partial (iOS)   | Graceful       |

The `useVoiceCommandRouter` hook surfaces `isSupported` for the UI to show an
appropriate message when voice input is unavailable.

---

## File Index

| File | Purpose |
|------|---------|
| `src/engines/voiceCommandEngine.ts` | Parses transcript → VoiceCommandType (V5 + Sprint 7) |
| `src/engines/voiceCommandConfirmationEngine.ts` | Personality-aware spoken confirmations (Sprint 7) |
| `src/engines/voiceCommandRouterEngine.ts` | Dispatch table + safety checks (Sprint 7) |
| `src/hooks/useVoiceCommandRouter.ts` | React hook wiring the full pipeline (Sprint 7) |
| `src/hooks/useVoiceCommands.ts` | Web Speech API hook with graceful fallback (V5) |
| `src/hooks/useLastGuidance.ts` | Last-guidance memory + repeat (V5) |
| `src/engines/guidancePersonalityEngine.ts` | Message shaping by personality (V5) |

---

## Tests

`tests/sprint7VoiceCompanion.test.ts` — 24 sections, 130+ assertions:

1. New command parsing (start_navigation / stop_navigation)
2. Command priority ordering
3. V5 backward compatibility
4. label() method for new commands
5. Confidence values
6. Confirmation messages — personality variants
7. Emergency stop always speaks
8. Minimal personality suppression
9. Companion personality warmth
10. Detailed personality extra context
11–13. Router dispatch for session and navigation commands
14. Session-dependent commands blocked without session
15. Emergency stop never blocked
16. save_this_place location consent gate
17. Safety checks always present
18. writesLocation() helper
19. isSessionCommand / isNavigationCommand helpers
20. Unknown command handling
21. Blocked commands speak reason
22. getBlockedConfirmation utility
23. Personality context propagates to confirmations
24. End-to-end: parse → route

All V5 tests (72/72) remain green.
