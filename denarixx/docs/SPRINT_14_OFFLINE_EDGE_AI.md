# Sprint 14: Offline Mode & Edge AI for Smart Glasses

**Sprint:** 14 (Phase 5 — Expanded Access)
**Status:** Complete
**Tests:** 152/152 passing

---

## Architecture Priority

```
1. Smart glasses (primary device)
   └── Glasses compute module (edge AI, inference, I/O)
       ├── Glasses cameras (front + side)
       ├── Bone-conduction audio output
       ├── Glasses microphone (speech input)
       └── Haptic feedback (wrist/frame)

2. Edge AI on glasses compute module
   └── On-device inference → no cloud required for safety

3. Phone / web app (secondary: setup, dashboard, fallback)
   └── Extends glasses capability; not the primary device

4. Cloud AI (optional enhancement)
   └── Richer scene understanding when connectivity available
```

Denarixx Vision AI is designed to run **on smart eyeglasses**. The phone app is a setup interface, monitoring dashboard, and safety fallback — not the primary runtime environment. All safety-critical functions run on the glasses compute module, offline, with no dependency on a phone or internet connection.

---

## Overview

Sprint 14 adds comprehensive offline capability and wearable edge AI architecture to Denarixx Vision AI. When the glasses compute module has no internet (or the phone companion is disconnected), all Guardian functions, Memory, Navigation, Voice, and Companion features continue operating safely using on-device models downloaded to the glasses.

---

## Glasses-First Offline Architecture

### Hardware Stack

```
Denarixx Vision Glasses
├── Compute module (ARM / dedicated NPU)
│   ├── Edge vision model     (48 MB, always ready on-device)
│   ├── Edge memory index     (8 MB, always ready on-device)
│   ├── Edge navigation cache (12 MB, always ready on-device)
│   └── Edge speech synthesis (22 MB, device TTS fallback)
├── Front camera + side cameras → real-time hazard input
├── Bone-conduction speaker → Guardian guidance output
├── Glasses microphone → voice commands input
└── Haptic actuators → tactile safety alerts

Phone Companion (secondary)
├── Setup and configuration dashboard
├── Larger model downloads (offloaded to phone when nearby)
├── Cloud API proxy (when online)
└── Safety fallback if glasses compute fails

Cloud (optional)
└── Enhanced scene understanding, model updates
```

### Offline Safety Principle

Safety-critical guidance **never** waits for the network or the phone. The Guardian always produces hazard alerts using the glasses compute module:

```
Glasses camera → glasses compute module → Guardian edge model
                                        → bone-conduction guidance
                                          (always, regardless of connectivity)
```

The `guardianLanguage` is always English at the core — translations are applied at the audio output layer. All critical alerts are synchronous with no cloud or phone dependency.

---

## Engine Graph

```
networkMonitorEngine    ─── tracks glasses↔cloud and glasses↔phone link status
        │
offlineEngine           ─── orchestrator; routes features through glasses-first
   │                        capability table
   ├── offlineEdgeEngine         ─── inference on glasses compute module
   │                                 (vision, speech, nav, memory models)
   ├── offlineModelRegistryEngine ─── model lifecycle on glasses storage
   └── offlineSyncEngine         ─── queues changes for cloud sync on reconnect
```

---

## Engines

### `networkMonitorEngine.ts`

Tracks the glasses compute module's connectivity to the cloud and (separately) to the phone companion. Pure functional — no browser APIs.

| State | Meaning for Glasses |
|-------|---------------------|
| `online` | Cloud reachable via phone or Wi-Fi |
| `offline` | No cloud; glasses operate entirely on edge |
| `weak` | Connected but unreliable; throttle cloud calls |
| `reconnecting` | Glasses attempting to re-establish link |
| `sync-pending` | Glasses online but queued data not yet uploaded |

Key functions:
- `detectNetworkStatus(isConnected, bandwidth, latency, attempts, hasPending)`
- `estimateQuality(bandwidth, latency)` → `excellent | good | poor | none`
- `goOnline / goOffline / goWeak / goReconnecting` — immutable transitions
- `buildNetworkDiagnostic(reading)` — diagnostic object for dashboard

### `offlineEngine.ts`

Glasses-first offline orchestrator. Manages which features run entirely on the glasses compute module vs. which benefit from cloud enhancement.

**Capability Table — all 10 features run on glasses offline:**

| Feature | Glasses Offline | Quality | Edge Model |
|---------|-----------------|---------|------------|
| hazard-detection | ✓ | partial | vision (glasses) |
| navigation | ✓ | cached | navigation cache |
| memory | ✓ | **full** | memory index |
| guardian | ✓ | partial | vision (glasses) |
| voice | ✓ | partial | speech-synthesis |
| companion | ✓ | partial | — (cached context) |
| language | ✓ | **full** | — (dictionary) |
| preferences | ✓ | **full** | — (local store) |
| trust | ✓ | cached | — (local history) |
| accessibility | ✓ | **full** | — (local prefs) |

"Partial" means edge inference without cloud enhancement — still fully safe and usable, just less contextually rich than with cloud assistance.

### `offlineEdgeEngine.ts`

On-device AI inference pipeline running on the glasses compute module. Not a replacement for V15 `edgeInferenceEngine.ts` — this is the glasses-specific offline inference layer.

**Model Registry (stored on glasses):**

| ID | Type | Size | Default Status |
|----|------|------|----------------|
| edge-vision-v1 | vision | 48 MB | ready (glasses) |
| edge-speech-synth-v1 | speech-synthesis | 22 MB | ready (glasses) |
| edge-speech-recog-v1 | speech-recognition | 35 MB | not-downloaded |
| edge-nav-v1 | navigation | 12 MB | ready (glasses) |
| edge-memory-v1 | memory | 8 MB | ready (glasses) |

**Integrity checking** — `checkModelIntegrity(model)` validates SHA-256. Corrupted models are flagged before inference.

**Inference simulation** — `runOfflineInference(models, type, tick)` cycles through 8 detection scenarios representing what the glasses cameras would see.

**Speech output** — `runOfflineSpeechSynthesis` routes to the bone-conduction speaker via the on-device speech model, falling back to device TTS if the edge model is not downloaded.

### `offlineModelRegistryEngine.ts`

Full lifecycle management for models stored on the glasses compute module:

```
not-downloaded → downloading → ready (on glasses) → stale → updating → ready
                                                  └─→ corrupted → re-download
```

Key functions:
- `getPriorityDownloadOrder(models)` — downloads safety-critical models first (vision, memory)
- `getDownloadPlan(models, batteryPct)` — respects glasses battery constraints
- `validateModelCoverage(models)` — confirms all 5 AI functions are covered
- `isCriticalModelMissing(models)` — vision + memory are critical for glasses safety
- `getStorageSummary(models)` — glasses onboard storage usage

### `offlineSyncEngine.ts`

Queues data changes made while the glasses are offline (cloud disconnected). Syncs to cloud when connectivity returns — typically via the phone companion acting as a bridge.

**Sync Categories:**
- navigation-history
- memories
- preferences
- permissions
- analytics
- language-prefs
- accessibility-prefs

**Conflict Strategies:**

| Strategy | Behaviour |
|----------|-----------|
| `latest-wins` | Whichever timestamp is newer wins |
| `local-wins` | Keep glasses-side data |
| `remote-wins` | Accept cloud/phone data |
| `merge` | Combine both (simplified) |

**Retry** — up to `MAX_SYNC_RETRIES` (3). Glasses buffer data locally until sync succeeds.

---

## UI Pages

These pages run on the **phone companion app** as a monitoring dashboard. The glasses themselves surface status through bone-conduction audio and haptic patterns.

### `/offline-status`
- Live glasses network status (cloud link + phone companion link)
- Simulate online / offline / weak / reconnecting states
- Glasses offline readiness check with issue list
- Feature capability table showing glasses-native vs. cloud-enhanced quality
- Guardian, Memory, and Navigation fallback descriptions for glasses-offline mode
- Privacy panel for sync data

### `/models`
- Edge model cards for models stored on glasses compute module
- Download/remove actions (transferred to glasses via phone companion)
- Integrity check runner (validates models on glasses storage)
- Storage summary (glasses onboard storage: installed / pending MB)
- Model coverage validation (all 5 AI types)
- Version summary table

### `/sync`
- Queue management for data accumulated on glasses while offline
- Conflict simulation and resolution
- Category breakdown of pending items
- Activity log (last 20 sync events)
- Failed record retry

---

## Synchronization Flow

```
1. Glasses lose cloud connection (phone companion disconnected or no Wi-Fi)
   → networkMonitorEngine records transition timestamp
   → offlineSyncEngine begins queuing changed records on glasses

2. While glasses are offline
   → Guardian uses offlineEdgeEngine for vision inference (glasses cameras)
   → Bone-conduction speaker delivers guidance from on-device model
   → Haptic alerts continue via glasses haptic actuators
   → Memories read from glasses local index
   → New changes queue in glasses sync buffer

3. Glasses reconnect (phone companion regains internet, or Wi-Fi found)
   → networkMonitorEngine detects 'online' or 'sync-pending'
   → offlineSyncEngine.getNextBatch() returns up to 10 queued records
   → Batch syncs to cloud via phone companion bridge

4. Conflict detected
   → markRecordConflict(queue, id, remoteTimestamp)
   → resolveConflict applies chosen ConflictStrategy
   → ConflictReport stored for audit

5. Failed records
   → Retry up to MAX_SYNC_RETRIES (3) when connectivity available
   → resetAllFailed() to force retry
```

---

## Privacy Guarantees

- **Camera frames** from glasses are never stored, cached, or synced
- **Audio from glasses microphone** is never stored or synced
- **Bone-conduction output** is local only — no audio logging
- **Edge model inference** runs entirely on the glasses compute module
- **Navigation history** is summarised (waypoints, not raw GPS tracks)
- **Sync payloads** contain only anonymised preference/navigation data
- **GPS fuzzing** remains active (0.01° grid from V7 sensor engine)
- Phone companion receives only dashboard data, not raw sensor streams

---

## Edge AI Strategy

### Current (Sprint 14 — Simulation)

5 edge models simulate on-glasses-compute-module inference. Models are typed (`EdgeModelType`) but not real ML weights. Inference is deterministic/scenario-based.

### Future — Real On-Glasses Deployment

The `EdgeModel` type is designed for real deployment on glasses hardware:

- `integrityHash` — SHA-256 for tamper detection before loading on compute module
- `version` — semver for OTA model update management
- `sizeKb` — pre-download storage check (glasses have limited flash)
- `minBatteryPct` — prevents model loading when glasses battery critically low
- `ModelStatus` lifecycle — full download/OTA-update/corruption handling

Planned model formats:
- **ONNX** — cross-platform, runs on ARM compute module via ONNX Runtime
- **TFLite** — efficient on glasses NPU
- **CoreML** — for Apple Silicon companion if used

Models transfer from cloud → phone companion → glasses via BLE/USB.

---

## Testing

Run: `cd denarixx && npx tsx tests/offlineEngine.test.ts`

| Suite | Tests |
|-------|-------|
| networkMonitorEngine | 30 |
| offlineEngine | 35 |
| offlineEdgeEngine | 40 |
| offlineSyncEngine | 35 |
| offlineModelRegistryEngine | 15 |
| **Total** | **152** |

---

## Integration Points

| System | Glasses-First Integration |
|--------|--------------------------|
| Guardian | Runs on glasses compute module; fallback message via bone-conduction |
| Memory | Local index on glasses; syncs to cloud on reconnect |
| Navigation | Cached route data on glasses; live updates when cloud available |
| Language | Always full quality offline (dictionary on glasses) |
| Accessibility | Always full quality offline (prefs stored on glasses) |
| Privacy | Sync privacy — no camera/audio/biometric data ever synced |
| Companion | Cached context on glasses; full learning resumes when cloud available |
| Trust | Local trust history on glasses; cloud refinement when connected |
| Haptic (V16) | Alerts continue offline via glasses haptic actuators |
| Bone-conduction (V16) | Guidance audio from edge speech model on glasses |
