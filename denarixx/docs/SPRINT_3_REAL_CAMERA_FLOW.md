# Sprint 3 — Real Camera Flow

**Date:** 2026-07-04  
**Scope:** Wire the live browser camera into the Vision Session page. Simulation remains the fallback for denied or lost camera access.  
**Source of truth:** `docs/PHASE_1_TO_18_AUDIT_REPORT.md` Sprint 3 row.

---

## Goal

Replace the "simulation only" session with a real camera flow that captures JPEG frames every 3 seconds and sends them to `/api/vision/analyze-frame`, while keeping simulation as automatic fallback.

---

## Status: ✅ COMPLETE

All tasks delivered. See verification section for test counts and build result.

---

## Feature Summary

### Camera Status State Machine

Five states, defined in `src/engines/cameraStateEngine.ts`:

| Status | Meaning | Frame source |
|--------|---------|-------------|
| `inactive` | Camera not started | Simulation |
| `requesting` | Browser permission prompt shown | Simulation |
| `active` | Stream live — frames captured every 3 s | **Real camera** |
| `denied` | Browser denied permission | Simulation |
| `fallback` | Camera WAS active; stream lost mid-session | Simulation |

Only `active` produces real camera frames. All other states use simulation automatically.

### Real Camera Flow

1. User clicks **Start Camera** → `useCameraCapture.requestCamera()` calls `getUserMedia({ video: ..., audio: false })`.
2. Status transitions: `inactive` → `requesting` → `active` (or `denied` on failure).
3. Each video track gets an `ended` event listener. If the browser revokes camera access or the device disconnects mid-session, status immediately becomes `fallback`.
4. Every 3 seconds (or per battery-aware interval), `useVisionSession.runFrame()` checks `cameraStatus === 'active'` — if true, it calls `captureFrame()` which draws the `<video>` element to a hidden `<canvas>` and returns a JPEG base64 data URL.
5. The frame (or `undefined` for simulation) is POSTed to `/api/vision/analyze-frame` with `source: 'camera' | 'simulation'`.
6. The API returns detections, scene analysis, and hazard alerts — identical pipeline for both sources.

### Fallback Behaviour

- **Denied:** Permission dialog was dismissed/blocked. Status stays `denied`. Session runs fully on simulation. Start Camera button remains available for retry.
- **Fallback:** Camera was active and then lost (browser revoked, device removed). Status becomes `fallback` automatically via the `track.ended` event listener. Session immediately continues on simulation with no interruption. A **Retry Camera** button (with a 🔄 icon) appears in the camera panel.

### Privacy Constraints (`CAMERA_PRIVACY_RULES`)

| Rule | Value |
|------|-------|
| `noVideoStorage` | `true` — frames never written to disk/IndexedDB/localStorage |
| `noFaceRecognition` | `true` — only scene/object-level analysis; face recognition unconditionally disabled |
| `noAudioCapture` | `true` — `audio: false` in `getUserMedia` constraints |
| `jpegCompressionQuality` | `0.7` — JPEG encoding before API transmission |
| `maxFrameWidthPx` | `640` px — getUserMedia width constraint |
| `framePurposeDescription` | "Assistive scene analysis only — frames are not retained after processing" |

Privacy notice is shown in the camera panel on the Session page at all times.

---

## Files Changed

### New

| File | Purpose |
|------|---------|
| `src/engines/cameraStateEngine.ts` | Pure functions — state machine logic, source-mode selection, privacy rules, labels, announcements |
| `tests/cameraFlow.test.ts` | 57 tests covering all 5 statuses, privacy rules, state transitions |
| `docs/SPRINT_3_REAL_CAMERA_FLOW.md` | This document |

### Updated

| File | Change |
|------|--------|
| `src/hooks/useCameraCapture.ts` | `CameraStatus` now imported from `cameraStateEngine`; re-exported for backward compat; added `track.ended` → `fallback` listener |
| `src/app/session/page.tsx` | `CameraStatusBadge` gains `fallback` entry; `isSimulation` uses `isSimulationMode()`; `modeLabel` uses `getCameraModeLabel()`; camera panel shows fallback-specific message + Retry Camera button; `canStartCamera()` drives button disabled state |

---

## Camera Panel UI States

| Status | Preview area | Button label | Inline status |
|--------|-------------|-------------|---------------|
| `inactive` | 📷 "Camera not started" | Start Camera | ● Simulation active |
| `requesting` | ⏳ "Waiting for permission…" | Requesting… (disabled) | ● Simulation active |
| `active` | 🎥 Live `<video>` element with LIVE badge | Start Camera (disabled) | — |
| `denied` | 🚫 "Camera access denied" | Start Camera | ⚠ Permission denied — simulation active |
| `fallback` | ⚠️ "Camera connection lost" | 🔄 Retry Camera | ⚠ Camera lost — simulation active |

---

## Architecture Decisions

### `CameraStatus` defined in engine, not hook
`CameraStatus` is now defined in `src/engines/cameraStateEngine.ts` (a pure module) and re-exported from `src/hooks/useCameraCapture.ts`. This enables the engine to be tested in Node.js (tsx) without needing browser globals, while keeping backward compatibility for all existing importers.

### `fallback` is semantically distinct from `denied`
- `denied` = permission was never granted (or was blocked by the user explicitly).
- `fallback` = camera WAS working, then lost connection (browser revoke, device disconnect).
Both trigger simulation mode, but only `fallback` offers "Retry Camera" as a meaningful action. Both `denied` and `fallback` allow `canStartCamera()` to return `true`.

### Frame source selection is status-gated, not feature-flagged
`getCameraSourceMode(status)` returns `'camera'` only for `'active'`. Any other status — including `'requesting'` (stream not yet ready) — uses simulation. This prevents partial or empty frames from being sent to the API.

### Track `ended` listener pattern
Each video track gets an `ended` event listener immediately after `getUserMedia` succeeds. This is the browser standard for detecting mid-session camera loss (permission revoke, device unplug, tab visibility change on some mobile browsers). The listener:
1. Sets status to `'fallback'`
2. Clears `streamRef.current`
3. Clears `videoRef.current.srcObject`
No additional polling needed.

---

## Verification

### Tests
```
npx tsx tests/cameraFlow.test.ts
Results: 57 passed, 0 failed
```

All previous test suites still passing (1,824 total).

### TypeScript
```
npm run type-check → 0 errors
```

### Build
```
npm run build → clean (0 warnings, 0 errors, 47/47 pages)
```

---

## What Was NOT Changed

- No new API routes (existing `/api/vision/analyze-frame` handles both camera and simulation).
- No changes to engine logic, hazard detection, or safety decision engines.
- No changes to the simulation engine — it remains the default and fallback.
- No face recognition added (hard-blocked at both privacy-rule and API level).
- No video storage (frames are ephemeral JPEG strings in memory only).
- The 3-second frame interval is unchanged (battery-aware skipping from V7 still applies).
