# Sprint 14: Offline Mode & Edge AI

**Sprint:** 14 (Phase 5 — Expanded Access)
**Status:** Complete
**Tests:** 155/155 passing

---

## Overview

Sprint 14 adds comprehensive offline capability and edge AI architecture to Denarixx Vision AI. The Guardian, Memory, Navigation, and Language systems all operate safely when no internet connection is available, using downloaded on-device models and cached data.

---

## Architecture

### Offline-First Safety Principle

Safety-critical functions never wait for the network. The Guardian always produces guidance using local inference when offline:

```
User → Guardian → [online? cloud analysis : local edge model]
                → guidance (always produced)
```

The `guardianLanguage` remains English regardless of network status. All critical safety alerts are generated synchronously with no cloud dependency.

### Engine Graph

```
networkMonitorEngine   ─── tracks online/offline/weak/reconnecting status
        │
offlineEngine          ─── orchestrator; routes features to offline capability table
   ├── offlineEdgeEngine         ─── on-device inference (vision, speech, nav, memory)
   ├── offlineModelRegistryEngine ─── lifecycle: download → ready → stale → update
   └── offlineSyncEngine         ─── sync queue, conflict resolution, retry logic
```

---

## Engines

### `networkMonitorEngine.ts`

Tracks network connectivity and quality. Pure functional — no browser APIs.

| State | Meaning |
|-------|---------|
| `online` | Full connectivity |
| `offline` | No connection |
| `weak` | Connected but < 500 Kbps or > 500ms latency |
| `reconnecting` | Attempting to restore connection |
| `sync-pending` | Online but local data not yet uploaded |

Key functions:
- `detectNetworkStatus(isConnected, bandwidth, latency, attempts, hasPending)` — classifies status
- `estimateQuality(bandwidth, latency)` — returns `excellent | good | poor | none`
- `goOnline / goOffline / goWeak / goReconnecting` — immutable state transitions
- `buildNetworkDiagnostic(reading)` — formatted diagnostic object

### `offlineEngine.ts`

Main offline orchestrator. Manages the capability table and fallback messages.

**Capability Table** (all 10 features):

| Feature | Offline | Quality | Requires Model |
|---------|---------|---------|----------------|
| hazard-detection | ✓ | partial | vision |
| navigation | ✓ | cached | navigation |
| memory | ✓ | **full** | memory |
| guardian | ✓ | partial | vision |
| voice | ✓ | partial | speech-synthesis |
| companion | ✓ | partial | — |
| language | ✓ | **full** | — |
| preferences | ✓ | **full** | — |
| trust | ✓ | cached | — |
| accessibility | ✓ | **full** | — |

### `offlineEdgeEngine.ts`

Local AI inference pipeline. Not a replacement for V15 `edgeInferenceEngine.ts` — this is the offline-specific layer that routes inference through downloaded models only.

**Model Registry** (5 models):

| ID | Type | Size | Default Status |
|----|------|------|----------------|
| edge-vision-v1 | vision | 48 MB | ready |
| edge-speech-synth-v1 | speech-synthesis | 22 MB | ready |
| edge-speech-recog-v1 | speech-recognition | 35 MB | not-downloaded |
| edge-nav-v1 | navigation | 12 MB | ready |
| edge-memory-v1 | memory | 8 MB | ready |

**Integrity checking** — `checkModelIntegrity(model)` validates SHA-256 hash. Corrupted models are flagged before use.

**Inference simulation** — `runOfflineInference(models, type, tick)` cycles through 8 detection scenarios with confidence scores between 0.70–0.95.

**Speech fallback** — `runOfflineSpeechSynthesis` falls back to the device's native TTS when the edge model is not downloaded.

### `offlineModelRegistryEngine.ts`

Full model lifecycle management:

```
not-downloaded → downloading → ready → stale → updating → ready
                                    └─→ corrupted → re-downloading → ready
```

Key functions:
- `getPriorityDownloadOrder(models)` — sorts download queue by priority
- `getDownloadPlan(models, batteryPct)` — splits queue into ready/blocked by battery
- `validateModelCoverage(models)` — checks all 5 types are covered
- `isCriticalModelMissing(models)` — vision + memory are critical
- `getStorageSummary(models)` — installed/pending MB counts

### `offlineSyncEngine.ts`

Manages the pending sync queue when offline data must be uploaded on reconnect.

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
| `local-wins` | Always use local data |
| `remote-wins` | Always use remote data |
| `merge` | Append both values (simplified) |

**Retry logic** — records retry up to `MAX_SYNC_RETRIES` (3). After that, status becomes `failed` and manual reset is required.

---

## UI Pages

### `/offline-status`
- Live network status card with status colour coding
- Simulate online / offline / weak / reconnecting
- Offline readiness check with issue list
- Feature capability table with degradation messages
- Guardian, Memory, and Navigation fallback descriptions
- Privacy panel for sync data

### `/models`
- Edge model cards with download/remove actions
- Integrity check runner
- Storage summary (installed / pending MB)
- Model coverage validation
- Version summary table

### `/sync`
- Queue management with add / sync / clear controls
- Conflict simulation and resolution
- Category breakdown of pending items
- Activity log (last 20 actions)
- Failed record retry

---

## Synchronization Flow

```
1. Device goes offline
   → offlineEngine records transition timestamp
   → syncQueue begins collecting changed records

2. While offline
   → Guardian uses offlineEdgeEngine for inference
   → Memories read from local cache
   → New records queue in syncQueue (category + payload)

3. Device reconnects
   → networkMonitorEngine detects 'online' status
   → offlineSyncEngine.getNextBatch() returns up to 10 records
   → Each record: markRecordSyncing → markRecordComplete | markRecordFailed

4. Conflict detected
   → markRecordConflict(queue, id, remoteTimestamp)
   → resolveConflict applies chosen ConflictStrategy
   → ConflictReport returned for audit

5. Failed records
   → Retry up to MAX_SYNC_RETRIES (3)
   → resetAllFailed() to retry manually
```

---

## Privacy Guarantees

- **Camera frames** are never stored, cached, or synced
- **Audio recordings** are never stored, cached, or synced
- **Edge model inference** runs entirely on-device
- **Navigation history** is summarised (waypoints only, not raw GPS tracks)
- **Sync payloads** contain only anonymised preference/navigation data
- **GPS fuzzing** remains active offline (0.01° grid from V7)

---

## Edge AI Strategy

### Current (Sprint 14 — Simulation)
5 edge models simulate on-device inference. Models are typed (`EdgeModelType`) but not real ML weights. Inference is deterministic/scenario-based.

### Future — Real On-Device Deployment
The `EdgeModel` type is designed for real model deployment:
- `integrityHash` — SHA-256 for tamper detection
- `version` — semver for update management
- `sizeKb` — pre-download budget check
- `minBatteryPct` — prevents download on critically low battery
- `ModelStatus` lifecycle — full download/update/corruption handling

Planned model formats: ONNX (cross-platform), TFLite (Android), CoreML (iOS).

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
| **Total** | **155** |

---

## Integration Points

| System | Integration |
|--------|------------|
| Guardian | `getGuardianFallbackMessage`, `getGuardianOfflineGuidance` |
| Memory | `getMemoryFallbackSummary`, `memoryOfflineReady` flag |
| Navigation | `getNavigationFallbackGuidance`, offline nav model |
| Language | Always full quality offline (dictionary-based) |
| Accessibility | Always full quality offline (local prefs) |
| Privacy | Sync privacy note, no camera/audio sync |
| Companion | Degraded mode — cached context only |
| Trust | Cached trust score offline |
