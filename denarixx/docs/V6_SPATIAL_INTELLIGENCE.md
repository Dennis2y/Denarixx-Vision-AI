# V6 Spatial Intelligence & Mobility Engine

Phase 6 transforms Denarixx Vision AI from object detection into a full spatial
understanding system — a live internal world model that knows where objects are,
where they are going, how wide the safe corridor is, and what the user should do next.

---

## Architecture

```
Detection[]  (from V1 VisionEngine / V4 providers)
    │
    ▼
SpatialReasoningEngine
    └─ Maps detections → SpatialObject[] with:
         distanceMetres, lateralOffset, direction,
         isMoving, movementDir, movementSpeed, isPermanent
    │
    ▼
PathPlanningEngine
    ├─ computeCorridor()     → WalkingCorridor (widthMetres, clearanceMetres, isPassable)
    ├─ predictMovement()     → MovementPrediction[] (willIntersect, timeToIntersection)
    └─ computeRecommendation() → PathRecommendation (action, instruction, urgency)
    │
    ▼
WorldModelEngine
    ├─ Object registry with TTL eviction (10 s)
    ├─ Landmark memory (confirmed after 2+ sightings)
    └─ Safe-frame counter
    │
    ▼
MobilityEngine (orchestrator)
    ├─ analyze(SpatialInput, frame) → WorldModelSnapshot
    └─ generateGuidance(snapshot, prevInstruction) → string | null
    │
    ▼
useVisionSession (integrated into runFrame loop)
    └─ Spatial guidance audio at 'low' priority when no hazard alert
```

---

## Spatial Object Model

Each detected object becomes a `SpatialObject`:

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | person / vehicle / bicycle / animal / furniture / landmark / obstacle |
| `distanceMetres` | number | Estimated metres from user |
| `direction` | enum | ahead / ahead_left / ahead_right / left / right / behind |
| `lateralOffset` | number | -1.0 (far left) → 0 (centre) → +1.0 (far right) |
| `isMoving` | boolean | True for people, vehicles, animals, bicycles |
| `movementDir` | enum | toward / away / crossing_left / crossing_right / parallel |
| `movementSpeed` | enum | stationary / slow / medium / fast |
| `isPermanent` | boolean | Fixed infrastructure (doors, stairs, benches) |

### Distance estimation

**Camera mode:** Uses bounding-box height in the normalised frame:
- `distanceMetres ≈ 0.06 / normHeight`
- bbox height 0.6 → ~0.1m, 0.3 → ~0.2m, 0.1 → ~0.6m, 0.02 → ~3m

**Simulation mode:** Seeded pseudo-random per `(label, frameIndex)`:
- Person: 1.5–8m, Vehicle: 4–25m, Furniture: 0.5–4m, etc.
- Deterministic within a frame; varied across frames.

---

## Walking Corridor

The `WalkingCorridor` describes available walking space:

| Field | Description |
|-------|-------------|
| `widthMetres` | Estimated clear corridor width |
| `clearanceMetres` | Distance to nearest ahead obstacle |
| `isPassable` | True if width ≥ 1m and clearance ≥ 0.8m |
| `suggestedOffset` | Recommended lateral shift (-1 = left, +1 = right) |

---

## Path Actions

| Action | When used |
|--------|-----------|
| `continue` | Path clear, no adjustment needed |
| `step_left` / `step_right` | Minor lateral adjustment |
| `turn_left` / `turn_right` | Significant deviation needed |
| `stop` | Obstacle < 0.8m ahead |
| `wait` | Moving object crossing in < 3 seconds |
| `cross` | Crosswalk clear |
| `detour` | Path blocked, wider reroute needed |
| `reverse` | Safer to move backward |

---

## Movement Prediction

For each moving object (`isMoving = true`):
- Estimates whether it will cross the user's path
- Computes `timeToIntersectionSeconds`
- Predicts future position at current velocity

High-priority predictions trigger `wait` recommendations.

---

## World Model (Persistent Memory)

`WorldModelEngine` maintains state across frames:

### Object Registry
- All objects stored with 10-second TTL
- Re-seen objects refresh their TTL
- Evicted when not seen for 10+ seconds

### Landmark Memory
- Objects classified as permanent infrastructure accumulate sightings
- Confirmed after 2+ frame appearances
- Max 30 landmarks stored simultaneously
- Used for scene recall: "You are near a door you have passed before"

### Safe Frame Counter
- Increments each hazard-free frame
- Resets on any immediate/soon urgency
- Used by `isExtendedSafe(n)` for companion reassurance decisions

---

## Spatial Map Panel

The `SpatialMapPanel` component renders an SVG bird's-eye view:

```
┌─────────────────────────────────────────┐
│  CONTINUE                    [clear]    │
│                                         │
│          ·person 3m ahead               │
│                                         │
│  ────────│──────│────────   (corridor)  │
│          ▲                              │
│         YOU                            │
├─────────────────────────────────────────┤
│  Nav: The path ahead is clear…         │
│  [door] [bench]   (confirmed landmarks) │
└─────────────────────────────────────────┘
```

**Colour coding:**
- Yellow triangle: user position
- Amber dots: people
- Red dots: vehicles
- Green: landmarks
- Gray: obstacles
- Green band: safe walking corridor
- Pulse rings: moving objects

---

## Audio Guidance

Spatial guidance is spoken at `low` priority, after hazard alerts, using natural language:

> "The path ahead is clear. Continue straight."
> "Walk slightly to your right. There's a bench 2 metres to your left."
> "Stop. A person is 0.4 metres directly ahead."
> "Wait here. Object crossing in approximately 2 seconds."
> "Continue straight for 5 metres, then reassess."

Repeated advisory instructions are suppressed (null return from `generateGuidance`)
to avoid speaking the same message every 3 seconds.

---

## Integration with Session Loop

The spatial pipeline is integrated into `useVisionSession.runFrame()`:

```
frame N:
  1. analyze-frame → detections
  2. spatialReasoningEngine.analyze() → SpatialObject[]         ← V6 NEW
  3. pathPlanningEngine.plan() → corridor + recommendation      ← V6 NEW
  4. worldModelEngine.update() → enriched snapshot              ← V6 NEW
  5. scene/describe → scene
  6. hazards/evaluate → alerts
  7. safety/decide → decision
  8. Audio: hazard alert > spatial guidance > companion > scene narration
```

The `state.spatialData` field in `SessionState` is updated every frame and
drives the `SpatialMapPanel` component in real time.

---

## Future: Smart Glasses Integration

The V6 spatial model is designed for direct smart glasses output:

- **Bone conduction audio:** Spatial guidance via `mobilityEngine.generateGuidance()`
- **HUD overlay:** SpatialObject positions map to display coordinates using the
  existing `lateralOffset` and `distanceMetres` fields
- **Haptic feedback:** `PathAction` maps to vibration patterns:
  - `stop` → strong pulse
  - `step_right` → right-side pulse
  - `wait` → slow rhythmic pulse
- **IMU integration:** Device orientation + spatial model → absolute world coordinates
- **Stereo audio cues:** Object `direction` and `lateralOffset` → binaural audio

---

## Files

| File | Role |
|------|------|
| `src/types/spatial.ts` | All V6 shared types |
| `src/engines/spatialReasoningEngine.ts` | Detection → SpatialObject[] |
| `src/engines/pathPlanningEngine.ts` | Corridor + path recommendation |
| `src/engines/mobilityEngine.ts` | Orchestrator + guidance text |
| `src/engines/worldModelEngine.ts` | Persistent landmark + object memory |
| `src/components/session/SpatialMapPanel.tsx` | Live SVG bird's-eye map |
| `tests/spatial.test.ts` | Comprehensive V6 tests |

---

## Tests

```bash
cd denarixx && npx tsx tests/spatial.test.ts
```

Covers 45+ cases:
- SpatialReasoningEngine: classification, coordinate estimation, camera vs simulation, determinism, movement flags
- PathPlanningEngine: corridor, blocking, lateral offset, recommendation, movement prediction
- MobilityEngine: snapshot validation, guidance deduplication, status summary
- WorldModelEngine: landmark accumulation, TTL eviction, reset, extended safe, recall
- Integration: 5-frame full pipeline smoke test
