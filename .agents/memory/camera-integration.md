---
name: Phase 2 Camera Integration
description: How real camera input is wired into the Vision Session without breaking simulation fallback.
---

## The rule
`useCameraCapture` manages the MediaStream lifecycle. `useVisionSession` reads camera state via refs (not hook dependencies) so the `setInterval` callback never captures stale values.

**Why:** `runFrame` is memoized with `useCallback([speak, addLog])`. Adding camera state as a dependency would force re-creating the interval on every camera status change, breaking the 3-second cadence and causing re-render loops.

**How to apply:**
- `cameraStatusRef.current = camera.status` and `captureFrameRef.current = camera.captureFrame` are assigned unconditionally at render time (not inside useEffect) — this is the correct React ref-sync pattern.
- In `runFrame`: `const imageData = cameraStatusRef.current === 'active' ? captureFrameRef.current() : null` — no camera deps needed.
- `captureFrame()` returns `null` if `video.readyState < 2` or stream is missing — always safe to call.
- Camera tracks are stopped on unmount via `useEffect` cleanup in `useCameraCapture`.

## Status states
`'inactive' | 'requesting' | 'active' | 'denied'`
- `denied` → session automatically falls back to simulation (imageData is null)
- No `'simulation'` state in the hook — simulation is implicit when camera is not active

## What is NOT done in Phase 2
- Real CV model inference — VisionEngine still uses MockVisionProvider regardless of imageData
- Face recognition — explicitly disabled
- Emergency streaming — explicitly disabled
- Video storage — frames are JPEG base64 sent over HTTPS only, never persisted

## Files
- `denarixx/src/hooks/useCameraCapture.ts` — camera hook
- `denarixx/src/hooks/useVisionSession.ts` — session hook (integrated)
- `denarixx/src/app/session/page.tsx` — UI with CameraStatusBadge component
- `denarixx/src/app/api/vision/analyze-frame/route.ts` — now returns `mode` and `frameReceived` fields
