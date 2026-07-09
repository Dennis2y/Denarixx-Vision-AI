# Sprint 15: No-Internet Street Safety Mode

**Sprint:** 15 (Phase 5 — Expanded Access)
**Status:** Complete
**Tests:** 165/165 passing

---

## Core Principle

Blind users lose internet outside. Core safety must work without it.

Denarixx Vision Glasses run all street safety functions on the glasses compute module. Internet is never a dependency for critical alerts. Phone and cloud are optional enhancements.

---

## Architecture Priority

```
1. Denarixx Vision Glasses (primary device)
   ├── Glasses compute module (ARM/NPU)
   │   ├── localHazardPatternEngine  — on-glasses pattern library
   │   ├── offlineStreetGuardianEngine — critical alert decisions
   │   ├── connectivityFallbackEngine — internet loss detection
   │   └── streetSafetyEngine — orchestrator
   ├── Glasses cameras (front + side) — hazard input
   ├── Bone-conduction speaker — spoken guidance output
   ├── Glasses microphone — voice commands
   └── Haptic actuators — tactile alerts

2. Phone companion (secondary — setup + dashboard + fallback)
   └── /street-safety page — monitoring, simulation, safety rules

3. Cloud AI (optional — scene enhancement when connected)
   └── Richer scene understanding, never required for safety
```

---

## What Sprint 15 Adds

### The Problem

If a blind user's internet drops while they are crossing a street:
- Cloud-dependent systems go silent
- The user receives no guidance at the most dangerous moment

### The Solution

Sprint 15 adds a complete offline street safety layer that:
1. Detects internet loss immediately
2. Announces: *"Internet is unavailable. Offline street safety mode is active."*
3. Continues all critical guidance using glasses edge AI
4. When internet returns, announces: *"Online enhancement restored. Safety mode remains active."*
5. Never waits for cloud AI for any critical alert

---

## Engines

### `localHazardPatternEngine.ts`

12-entry pattern library stored on the glasses compute module. No internet required.

**Hazard types:**

| Type | Default Severity | Critical Threshold |
|------|------------------|--------------------|
| obstacle | high | 0.85 |
| stairs | critical | 0.60 |
| vehicle | critical | 0.50 |
| crossing | high | 0.75 |
| person-approaching | medium | 0.90 |
| bicycle-scooter | high | 0.70 |
| stop | critical | 0.40 |
| slow-down | medium | 0.80 |
| move-left | medium | 0.85 |
| move-right | medium | 0.85 |
| camera-failure | critical | 0.00 (always critical) |
| unknown | medium | 0.90 |

Key functions:
- `getPatternForHazard(type)` — O(n) lookup in local pattern library
- `matchHazardFromKeywords(keywords)` — maps text tokens to hazard types
- `getAllCriticalPatterns()` — vehicle, stairs, stop, camera-failure + low-threshold types
- `estimateHazardSeverity(type, confidence)` — compares confidence to per-type threshold
- `buildLocalHazardPattern(type, direction, confidence, tick)` — immutable pattern
- `updateHazardPattern(existing, confidence, direction, tick)` — running average confidence
- `getOfflineGuidance(type, direction, confidence)` — generates guidance text, no cloud

### `connectivityFallbackEngine.ts`

Detects internet loss and activates glasses offline safety mode.

Key functions:
- `assessConnectivity(network)` → `connected | disconnected | weak | checking`
- `determineSafetyMode(connectivity)` → `online | offline | degraded`
- `updateFallbackConfig(current, network, tick)` — immutable config update, sets announcement
- `calculateOfflineDurationSeconds(config, tick)` — time since glasses went offline
- `consumeAnnouncement(config)` — extract pending spoken message (clears after reading)
- `buildConnectivityTransition(from, to, tick)` — transition message for bone-conduction
- `getFallbackGuidanceSource(config)` → `glasses-edge | phone-fallback | cloud-enhanced`

**Transition messages (hardcoded, no cloud needed):**

| Transition | Spoken via Bone-Conduction |
|------------|---------------------------|
| online → offline | "Internet is unavailable. Offline street safety mode is active." |
| offline → online | "Online enhancement restored. Safety mode remains active." |

### `offlineStreetGuardianEngine.ts`

Guardian decision engine running entirely on glasses compute module. Never depends on network.

**Cooldown table (ticks):**

| Severity | Cooldown |
|----------|----------|
| critical | 2 ticks |
| high | 5 ticks |
| medium | 8 ticks |
| low | 12 ticks |

**Critical bypass:** Vehicle, stairs, stop, camera-failure hazards bypass the cooldown entirely — they always produce an alert regardless of how recently they were last spoken.

Key functions:
- `isCriticalBypass(hazard)` — vehicle/stairs/stop/camera-failure always bypass throttle
- `evaluateHazardForSpeech(hazard, recentAlerts, tick)` → `OfflineGuardianDecision`
- `evaluateAllHazards(hazards, recentAlerts, tick)` — prioritises + deduplicates
- `prioritizeHazards(hazards)` — severity → confidence order
- `buildOfflineAlert(hazard, tick)` — complete alert with spoken message
- `buildCriticalBypassAlert(hazard, tick)` — always-speak variant
- `buildCameraFailureAlert(tick)` — immediate camera warning alert
- `selectGuidanceForHazard(type, direction, confidence)` — never returns "safe to cross"

### `streetSafetyEngine.ts`

Main orchestrator. Processes per-tick input from glasses cameras and network monitor.

```
Glasses cameras
      │
      ▼
streetSafetyEngine.processStreetSafetyTick(state, input)
      │
      ├── connectivityFallbackEngine.updateFallbackConfig
      │     └── if connectivity change: set announcementPending
      │
      ├── clearStaleHazards (remove hazards not seen in 10 ticks)
      │
      ├── upsertHazard (add/update from glasses camera detections)
      │
      ├── offlineStreetGuardianEngine.evaluateAllHazards
      │     └── isCriticalBypass? → always speak
      │     └── isInCooldown? → silent
      │     └── confidence < 0.2? → silent
      │     └── otherwise → speak
      │
      └── returns: { state, announcements, alertsSpoken }
                             │               │
                    spoken via             → bone-conduction
                    bone-conduction          speaker on glasses
```

Key functions:
- `createStreetSafetyState()` — factory
- `processStreetSafetyTick(state, input)` — main per-tick processor
- `upsertHazard(hazards, type, direction, confidence, tick)` — add or update
- `clearStaleHazards(hazards, tick)` — remove hazards older than 10 ticks
- `addAlerts(existing, new)` — append to ring buffer (max 20)
- `buildStreetSafetySummary(state)` — summary for phone dashboard
- `getStreetSafetModeLabel(state)` — mode string for UI
- `getStreetSafetyModeColor(state)` — `green | yellow | red`

---

## Safety Rules (Hardcoded on Glasses)

### Crossing Safety — Never Say "Safe to Cross"

```typescript
// ALWAYS:
"The path appears clear, but please check carefully before crossing."

// NEVER:
"Safe to cross." — prohibited string, absent from all guidance text
```

The crossing pattern entry has `neverSafeToPass: true`. The `selectGuidanceForHazard` function for crossing type always returns `CROSSING_SAFETY_MESSAGE`, regardless of confidence.

### Camera Failure — Immediate Warning

If the glasses cameras become unavailable:
```
"Warning: Glasses camera is not available. Please stop, use caution, and seek assistance."
```
This alert:
- Has confidence 1.0 (always triggers)
- Has severity `critical`
- Bypasses all cooldown checks
- Is produced on the same tick that camera failure is detected

### Critical Alerts — Never Blocked

Vehicle, stairs, stop, and camera-failure alerts bypass the cooldown engine (`isCriticalBypass = true`). They are spoken every time they are detected, even if recently spoken. No internet is required.

---

## UI — `/street-safety` (Phone Dashboard)

The `/street-safety` page runs on the phone companion as a monitoring and simulation dashboard.

**Panels:**

| Tab | Content |
|-----|---------|
| Status | Mode indicator, Guardian status, top hazard, glasses primary note |
| Hazards | Active hazards from glasses cameras, severity badges, confidence |
| Alerts | Recent spoken alerts (via bone-conduction), tick, confidence |
| Safety Rules | Hardcoded rules, architecture priority list |

**Controls (simulation):**
- Network: Online / Weak / Offline (triggers connectivity mode change + announcement)
- Camera toggle: healthy / failed (triggers camera failure alert)
- Hazard injector: 8 scenarios (vehicle, stairs, obstacle, crossing, person, bicycle, stop, move-left)

---

## Type System

`src/types/streetSafety.ts` — separate file, never merge with `index.ts`.

Key constants:
```typescript
CROSSING_SAFETY_MESSAGE = "The path appears clear, but please check carefully before crossing."
CAMERA_FAILURE_MESSAGE  = "Warning: Glasses camera is not available. Please stop..."
OFFLINE_MODE_ANNOUNCEMENT = "Internet is unavailable. Offline street safety mode is active."
ONLINE_RESTORED_ANNOUNCEMENT = "Online enhancement restored. Safety mode remains active."
GLASSES_PRIMARY_NOTE = "All street safety functions run on the glasses compute module..."
```

---

## Testing

Run: `cd denarixx && npx tsx tests/streetSafety.test.ts`

| Suite | Tests |
|-------|-------|
| localHazardPatternEngine | 40 |
| connectivityFallbackEngine | 42 |
| offlineStreetGuardianEngine | 43 |
| streetSafetyEngine | 32 |
| Safety Rule Verification | 8 |
| **Total** | **165** |

---

## Integration with Sprint 14

Sprint 15 builds on the Sprint 14 offline architecture:

| Sprint 14 | Sprint 15 |
|-----------|-----------|
| `NetworkReading` type | Used by `connectivityFallbackEngine` to detect internet loss |
| Glasses-first principle | Extended — street safety is explicitly glasses-first |
| `networkMonitorEngine` | Sprint 15 uses the `NetworkReading` type from it |
| Offline safety note constants | Extended with `OFFLINE_MODE_ANNOUNCEMENT` and `ONLINE_RESTORED_ANNOUNCEMENT` |
