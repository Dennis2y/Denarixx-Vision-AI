---
name: useAudioGuidance return shape
description: The hook returns stop (not stopAudio) and CameraStatus values are inactive|requesting|active|denied not idle.
---

## Rule

`useAudioGuidance` returns `{ speak, stop, updateSettings, getVoices }`.  
- Destructure as `const { speak, stop: stopAudio, updateSettings } = useAudioGuidance()` when you need the name `stopAudio`.

`CameraStatus` (from `useCameraCapture`) is `'inactive' | 'requesting' | 'active' | 'denied'`.  
- Do NOT initialize `useRef<CameraStatus>('idle')` — `'idle'` is not a valid value.
- Use `'inactive'` as the default ref value.

**Why:** Two type errors emerged when rewriting `useVisionSession.ts` — `stopAudio` not found on the return type, and `'idle'` not assignable to `CameraStatus`. Both require looking at the hook's actual return type, not guessing.

**How to apply:** Before destructuring `useAudioGuidance` or initializing a CameraStatus ref, grep the hook's `return` statement to confirm the actual field names and the union type values.
