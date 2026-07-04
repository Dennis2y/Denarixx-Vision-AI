# V13 — Indoor & Outdoor Navigation Engine

## Overview

Phase 13 adds a full navigation intelligence layer to Denarixx Vision AI. Blind and low-vision users receive safe, short, useful guidance for both indoor room-to-room navigation and outdoor walking routes — without being overwhelmed with speech.

> **Simulation mode only.** No real GPS or map data is used. All routes are deterministic templates. Real routing (GPS turn-by-turn, OpenStreetMap, indoor positioning) requires separate hardware/API integration.

> **Speech principle:** Speak only when direction or safety changes. Remain quiet otherwise.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/navigation.ts` | All V13 types — separate from `src/types/index.ts` (V1 NavigationGuidance) |
| `src/engines/navigationIntelligenceEngine.ts` | Session lifecycle, guidance selection, tick processing |
| `src/engines/indoorNavigationEngine.ts` | Zone detection, room-to-room routes, venue modes |
| `src/engines/outdoorNavigationEngine.ts` | Heading/compass, road environment, outdoor route templates |
| `src/engines/routeSafetyEngine.ts` | Risk assessment from detected objects |
| `src/engines/landmarkGuidanceEngine.ts` | Landmark creation, detection, announcement |
| `src/engines/crossingDecisionEngine.ts` | Crossing safety evaluation (never asserts certainty) |
| `src/lib/navigationStore.ts` | In-memory session store |
| `src/app/navigation/page.tsx` | Full V13 navigation UI (replaces V1 stub) |
| `src/app/api/navigation/start/route.ts` | POST — create session |
| `src/app/api/navigation/update/route.ts` | POST — update heading/position/detections |
| `src/app/api/navigation/end/route.ts` | POST — end session |
| `src/app/api/navigation/landmark/route.ts` | POST — add landmark |
| `src/app/api/navigation/crossing-decision/route.ts` | POST — evaluate crossing |
| `tests/navigationEngine.test.ts` | Comprehensive engine tests |
| `docs/V13_INDOOR_OUTDOOR_NAVIGATION_ENGINE.md` | This file |

---

## Architecture

```
NavigationIntelligenceEngine  ←─ Session lifecycle, guidance selection, tick
         │
         ├── IndoorNavigationEngine    ←─ Zone detection, room-to-room routes
         ├── OutdoorNavigationEngine   ←─ Heading, compass, outdoor routes
         ├── RouteSafetyEngine         ←─ Risk from detected objects
         ├── LandmarkGuidanceEngine    ←─ Landmark awareness and announcement
         └── CrossingDecisionEngine    ←─ Crossing safety (never "safe to cross")
```

All engines are **pure functions** — no async, no I/O, fully testable.

---

## Route State Machine

```
idle → navigating → paused → navigating
                  ↘ arrived
                  ↘ rerouting → navigating
                  ↘ lost
```

---

## Indoor Navigation

**Supported zones:** room, corridor, stairs, elevator, escalator, doorway, entrance, exit

**Venue modes:** generic, office, supermarket, station, airport, shopping_mall

**Zone detection** from V12 object labels:
| Label | Zone |
|---|---|
| stairs | stairs |
| elevator | elevator |
| door | doorway / entrance / exit |
| chair + table | room |
| person (no chair) | corridor |

**Route templates** — triggered by destination keyword:
- "exit" / "out" → corridor → exit door
- "stairs" → corridor → stairwell
- "elevator" / "lift" → lobby → elevator
- "entrance" / "door" → entrance corridor
- any other → generic 3-segment route

---

## Outdoor Navigation

**Compass:** `parseHeading(degrees)` → N, NE, E, SE, S, SW, W, NW

**Deviation threshold:** 45° — exceeding this triggers `rerouting` state

**Heading instructions:**
| Deviation | Instruction |
|---|---|
| ≤ 10° | Continue straight. |
| 10–30° | Turn slightly right / left. |
| 30–70° | Turn right / left. |
| 70–130° | Turn sharply right / left. |
| > 130° | Turn around. |

**Route templates:**
- "bus stop" → pavement → crossing → bus stop
- "park" → entrance → main path
- "station" → road → crossing → station
- default → 4-segment generic route

---

## Crossing Decision Engine

**Critical privacy principle: NEVER say "safe to cross" with certainty.**

All messages use safe hedging language:
- `"The crossing appears clear, but please check carefully before crossing."`
- `"Stop before the crossing. Please check carefully."`
- `"Light signal detected. The crossing appears clear, but please check carefully before crossing."`

**Risk levels:**
| Condition | Risk |
|---|---|
| 2+ vehicles detected | critical → stop |
| 1 vehicle detected | high → wait and check |
| Construction barrier | high → wait and check |
| No vehicles | moderate → proceed with care |

---

## Route Safety Engine

**Risk from detected objects:**
| Object | Context | Risk |
|---|---|---|
| car | outdoor crossing | critical |
| car | outdoor road | high |
| construction_barrier | anywhere | high |
| stairs | outdoor | high |
| stairs | indoor | moderate |
| person / dog / bike | anywhere | moderate |
| bag / tree / sign | anywhere | low |
| none | anywhere | clear |

**Auto-pause:** navigation pauses automatically at `critical` or `high` risk.

---

## Landmark Guidance Engine

Landmarks detected from V12 labels:
| Label | Landmark type |
|---|---|
| door | door |
| stairs | stairs |
| elevator | elevator |
| crosswalk | crossing |
| traffic_light | traffic_light |

Landmark announcements:
```
"Stairs: Stairs ahead in about 10 metres."
"Door: Main exit ahead."
"Crossing: Pedestrian Crossing ahead."
```

Route memory: only saved if `locationConsentGiven === true`.

---

## API Reference

### POST /api/navigation/start
```json
{ "destination": "Bus stop", "mode": "outdoor", "locationConsent": false }
```
Returns: `{ sessionId, mode, destination, state, segmentCount, firstInstruction, privacy }`

### POST /api/navigation/update
```json
{ "sessionId": "nav-...", "headingDeg": 45, "distanceTraveledM": 5, "detectedLabels": ["car"] }
```
Returns: `{ state, riskLevel, currentSegment, guidance, distanceRemainingM }`

### POST /api/navigation/end
```json
{ "sessionId": "nav-..." }
```
Returns: `{ sessionId, state, destination, endedAt }`

### POST /api/navigation/landmark
```json
{ "sessionId": "nav-...", "name": "Coffee shop", "type": "custom", "estimatedDistanceM": 20 }
```
Returns: `{ landmark, announcement, totalLandmarks }`

### POST /api/navigation/crossing-decision
```json
{ "sessionId": "nav-...", "detectedLabels": ["car", "traffic_light"], "environment": "crossing" }
```
Returns: `{ crossingType, riskLevel, vehiclesDetected, suggestedAction, message, disclaimer }`

---

## Privacy

| Guarantee | Default |
|---|---|
| No precise GPS stored | ✓ On |
| Route memory requires consent | ✓ Enforced |
| No third-party sharing | ✓ Always |
| All processing local | ✓ On-device |

---

## Speech Guidance Principles

- Cooldown: **4 seconds** between messages
- Critical risk **bypasses** cooldown
- Never narrate unchanged state
- Short, directive language only:
  - `"Continue straight."`
  - `"Turn slightly right."`
  - `"Stop before the crossing."`
  - `"Doorway ahead on your left."`
  - `"Stairs ahead. Slow down."`

---

## What Is Simulated vs Real

| Feature | V13 Status |
|---|---|
| Route templates | ✅ Simulated (deterministic) |
| Zone detection | ✅ From V12 object labels |
| Crossing evaluation | ✅ From detected labels |
| Heading/compass | ✅ Simulated drift |
| Speech guidance | ✅ Real (Web Speech API) |
| GPS coordinates | ❌ Not integrated |
| Real map routing | ❌ Not integrated |
| Indoor positioning | ❌ Not integrated |
| Traffic light colour | ❌ Not read (marked unknown) |
| Real-time traffic | ❌ Not integrated |

---

## Future Integration

1. **GPS routing** — OpenStreetMap + OpenRouteService for real turn-by-turn
2. **Indoor positioning** — BLE beacons or WiFi fingerprinting
3. **Traffic light state** — V12 camera pipeline colour detection
4. **Live crossing detection** — V12 real-time object tracking + velocity
5. **Haptic feedback** — V7 vibration patterns for turn left/right
6. **Compass fusion** — V7 `useDeviceSensors` DeviceOrientation API
