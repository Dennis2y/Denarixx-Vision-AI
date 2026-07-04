# Sprint 6 — Real Navigation Intelligence

## Overview

Sprint 6 connects GPS sensor data, compass readings, geolocation permissions,
landmark memory, and Cognitive Guardian alerts into a coherent navigation pipeline.
The result is a navigation system that speaks less when the user is on track,
speaks immediately when they deviate or face risk, and respects privacy by default.

All Sprint 6 additions are **backward-compatible** — no V13 engine functions were
removed or renamed.

---

## New Session States

Sprint 6 adds three new values to `RouteState`:

| State                | Meaning |
|---------------------|---------|
| `requesting_location` | Waiting for geolocation browser permission |
| `off_route`          | User has deviated from the route (heading > 45°) |
| `ended`              | User manually stopped navigation (vs. `arrived` at destination) |

The existing states (`idle`, `navigating`, `paused`, `arrived`, `rerouting`, `lost`)
are unchanged and continue to work exactly as before.

### State machine

```
idle → requesting_location → navigating
                           → navigating (denied, fallback mode)
navigating → off_route (heading deviation > 45°)
off_route → navigating (heading corrected)
navigating → paused → navigating
navigating → arrived (destination reached)
navigating → ended (user stopped)
```

---

## Geolocation Permission Flow

### Engine: `sensorNavigationBridgeEngine.ts`

| Function | Description |
|---|---|
| `buildGeolocationState(ctx)` | Maps `SensorContext` → `GeolocationState` with permission, GPS status, heading source, and warning text |
| `buildGeolocationWarning(permission, hasGPS, hasFallback)` | Returns a human-readable warning string or null |
| `selectHeadingFromSensor(ctx)` | Priority: compass → GPS track heading → fused headingDegrees → null |

### Permission states

| Permission | Meaning |
|---|---|
| `not_requested` | Browser has not shown the permission dialogue |
| `requesting` | Permission dialogue is open (browser-side) |
| `granted` | GPS available |
| `denied` | GPS blocked; compass/IMU fallback used if available |
| `unavailable` | Device has no geolocation support |

### Graceful fallback chain

1. **Compass** (`DeviceOrientationEvent.alpha`) — highest accuracy for heading
2. **GPS track heading** (`navigator.geolocation.watchPosition` → `coords.heading`) — requires movement
3. **Fused heading** (`SensorContext.headingDegrees`) — pre-fused from V7 sensorFusionEngine
4. **None** — navigation continues on simulated heading with a warning spoken to the user

---

## Route Guidance Types

Six typed guidance categories added to `RouteGuidanceType`:

| Type | Spoken guidance example |
|---|---|
| `continue_straight` | "Continue straight." |
| `turn_slightly_left` | "Turn slightly left." |
| `turn_slightly_right` | "Turn slightly right." |
| `stop` | "Stop immediately." / "Stop. [segment instruction]." |
| `crossing_ahead` | "Crossing ahead. Stop before crossing and check carefully." |
| `landmark_ahead` | "Bus stop: Oxford Street ahead in about 50 metres." |

`buildSensorHeadingInstruction(sensorDeg, targetDeg)` maps the heading deviation
to the appropriate guidance text using the same thresholds as V13:
- ≤10° → continue straight
- ≤30° → turn slightly left/right
- ≤70° → turn left/right
- ≤130° → turn sharply left/right
- >130° → turn around

---

## Sensor Integration

### `processNavigationTick` extended

```typescript
processNavigationTick(
  session: NavigationSession,
  tick: number,
  lastSpokenAt: number,
  sensorUpdate?: NavigationUpdate,  // Sprint 6: optional real sensor data
)
```

When `sensorUpdate` is provided, real heading and distance values replace the
sinusoidal drift simulation. The calling hook (`useVisionSession`) or navigation
page passes this from the live `SensorContext`.

### `buildNavigationUpdateFromSensor(ctx, simulatedDistanceM?)`

Converts a `SensorContext` to a `NavigationUpdate`:
- `headingDeg`: best available heading (compass > GPS > fused > undefined)
- `distanceTraveledM`: GPS speed × 0.5 s tick, or simulated walking pace

### Battery-aware tick skipping

`shouldSkipNavigationTick(ctx, tickNumber)`:
- **Low power mode**: process every 4th tick (75% reduction)
- **Standing still**: process every 2nd tick (50% reduction)
- **Walking/running**: process every tick

---

## Landmark Memory

### Privacy-first design

- Saving a landmark **requires `consentGiven === true`** — no silent saves
- Fuzzy coordinates are stored only when explicitly provided by the caller
- `LANDMARK_PRIVACY_WARNING` must be shown before the consent gate
- Revoking consent does not delete existing landmarks (user retains control)

### API

| Function | Description |
|---|---|
| `createLandmarkMemoryStore(consentGiven?)` | Create empty store, default consent = false |
| `saveLandmark(store, landmark, options?)` | Save with fuzzy lat/lng; returns `{ store, error? }` |
| `deleteSavedLandmark(store, id)` | Delete by ID; returns `{ store, deleted }` |
| `navigateToLandmark(store, id)` | Look up by ID; returns `SavedLandmark \| null` |
| `listSavedLandmarks(store)` | Return all landmarks, newest first |
| `findLandmarkByName(store, query)` | Case-insensitive partial name search |
| `setLandmarkMemoryConsent(store, bool)` | Update consent without touching landmarks |

### Error cases

| Error | Reason |
|---|---|
| `"Consent required to save landmarks..."` | `consentGiven === false` |
| `"Landmark store is full (N maximum)..."` | `landmarks.length >= maxLandmarks` |
| `"Landmark "X" is already saved."` | Duplicate ID detected |

---

## Navigation → Guardian Bridge

### `buildNavigationGuardianInput(session, detectedLabels?)`

Builds a `NavigationGuardianInput` that feeds navigation risk into the
Cognitive Guardian (`CognitiveGuardianEngine`):

```typescript
{
  riskLevel: RiskLevel,        // from NavigationSession
  detectedLabels: string[],    // from vision pipeline
  state: RouteState,
  crossingAhead: boolean,      // current/next segment is crossing OR label match
  offRoute: boolean,           // state is off_route or rerouting
  guidanceMessage: string | null,  // ready-to-speak Guardian message
}
```

### Risk mapping

| Navigation `RiskLevel` | Cognitive Guardian level |
|---|---|
| `clear` | `none` |
| `low` | `low` |
| `moderate` | `medium` |
| `high` | `high` |
| `critical` | `critical` |

### Guardian message rules

| Condition | Message |
|---|---|
| `riskLevel === 'critical'` | "Stop. High-risk area detected on your navigation route." |
| `crossingAhead && riskLevel !== 'clear'` | "Crossing ahead. Please stop and check carefully before proceeding." |
| `offRoute` | "You appear to be off your route. Turn to correct your heading." |
| `riskLevel === 'high'` | "Caution. High-risk area on your route." |
| `crossingAhead` (clear risk) | "Crossing ahead. Stop before crossing and check carefully." |
| Otherwise | `null` — Guardian stays silent |

---

## Privacy Defaults

| Constant | Value |
|---|---|
| `NAVIGATION_PRIVACY_DEFAULTS.noPreciseLocationByDefault` | `true` |
| `NAVIGATION_PRIVACY_DEFAULTS.consentRequiredForLandmarkSaving` | `true` |
| `NAVIGATION_PRIVACY_DEFAULTS.noThirdPartySharing` | `true` |
| `NAVIGATION_PRIVACY_DEFAULTS.showPrivacyWarningOnStart` | `true` |
| `LOCATION_PRIVACY_WARNING` | Multi-sentence plain-English warning |

The navigation session's `locationConsentGiven` starts as `false` and is only set
to `true` by `onLocationGranted()` — never silently.

---

## Architecture Decisions

- **No circular imports.** `sensorNavigationBridgeEngine` imports from
  `navigationIntelligenceEngine`; the reverse is not true. `processNavigationTick`
  accepts a `NavigationUpdate` (not `SensorContext`) — the bridge handles conversion.
- **`off_route` vs `rerouting`.** Both remain valid `RouteState` values.
  `off_route` is the Sprint 6 default for new deviation detection; `rerouting` is
  kept for backward compatibility. `isRouteActive()` includes both.
- **`ended` vs `arrived`.** `arrived` = destination reached. `ended` = user
  manually stopped. Both are terminal; `isRouteEnded()` covers both.
- **Landmark coordinates.** No precise GPS is stored by default. Even when consent
  is given, the caller is responsible for fuzzing the coordinates before passing
  them to `saveLandmark`. The engine never fuzzes internally — privacy logic lives
  in the V7 `locationPrivacyEngine`.

---

## Files Changed

| File | Change |
|---|---|
| `src/types/navigation.ts` | Added `requesting_location`, `off_route`, `ended` to `RouteState`; added `GeolocationPermission`, `GeolocationState`, `RouteGuidanceType`, `SavedLandmark`, `LandmarkMemoryStore`, `NavigationGuardianInput`, `LOCATION_PRIVACY_WARNING`, `NAVIGATION_PRIVACY_DEFAULTS` |
| `src/engines/sensorNavigationBridgeEngine.ts` | **New.** Sensor → NavigationUpdate bridge, GeolocationState builder, Guardian input builder |
| `src/engines/navigationIntelligenceEngine.ts` | Added `requestLocationPermission`, `onLocationGranted`, `onLocationDenied`, `endNavigation`, `setOffRoute`, `clearOffRoute`, `isRouteEnded`; updated `getRouteStateLabel`, `isRouteActive`, `selectGuidance`, `processNavigationTick`, `updateNavigationSession`, `pauseNavigation` |
| `src/engines/landmarkGuidanceEngine.ts` | Added `createLandmarkMemoryStore`, `saveLandmark`, `deleteSavedLandmark`, `navigateToLandmark`, `listSavedLandmarks`, `findLandmarkByName`, `setLandmarkMemoryConsent`, `LANDMARK_PRIVACY_WARNING`, `LANDMARK_MEMORY_MAX` |
| `tests/sprint6Navigation.test.ts` | **New.** ~95 tests across 9 sections |
| `docs/SPRINT_6_REAL_NAVIGATION_INTELLIGENCE.md` | **New.** This document |

---

## Test Summary

```
── Section 1: Navigation Session States      (24 tests)
── Section 2: Route Guidance                 (13 tests)
── Section 3: Geolocation Permission Flow    (10 tests)
── Section 4: Sensor → Navigation Bridge     (16 tests)
── Section 5: Navigation → Guardian Bridge   (10 tests)
── Section 6: Landmark Memory                (15 tests)
── Section 7: Privacy Defaults               (10 tests)
── Section 8: Route Guidance Types            (5 tests)
── Section 9: Integration                     (7 tests)
Total: ~110 tests
```
