# Live Accessibility Validation

> **Sprint 23: Live Perception Hardening & End-to-End Validation**
> Date: July 2026

This document validates accessibility for blind and low-vision users of the Denarixx Vision AI live session.

---

## Validation Summary

| Requirement | Status | Evidence |
|-------------|--------|---------|
| Full screen-reader support | ✅ Pass | All interactive elements have `aria-label`, roles, `aria-pressed`/`aria-checked` |
| No essential visual-only controls | ✅ Pass | All controls reachable via keyboard and voice commands |
| Voice-first onboarding | ✅ Pass | `OnboardingFlow` speaks each step via TTS |
| Large emergency control | ✅ Pass | Emergency stop button renders at `min-h-[56px]` with distinct red styling |
| One-action session start | ✅ Pass | Single "Start Session" button starts camera + session in one tap |
| Keyboard operation | ✅ Pass | All buttons and links are focusable; no click-only traps |
| Reduced motion | ✅ Pass | `reducedMotion` setting disables CSS transitions/animations |
| High contrast | ✅ Pass | `highContrastMode` applies `.high-contrast-mode` CSS class globally |
| Hearing-impaired haptic fallback | ✅ Pass | `vibrate()` called on critical/high alerts if `vibrationEnabled = true` |

---

## Detail: Screen Reader Support

### Session Page (`/session`)

All buttons have descriptive `aria-label` attributes:

```html
<button aria-label="Start session" ...>
<button aria-label="Stop session" ...>
<button aria-label="Emergency stop" ...>
<button aria-label="Repeat last guidance" ...>
<button aria-label="Enter walking mode" ...>
<button aria-label="Start camera" ...>
<button aria-label="Stop camera" ...>
```

Live regions announce dynamic content:
- `role="status"` on scene description — announced on change
- `aria-live="assertive"` on hazard alerts
- `aria-live="polite"` on audio log

### Settings Page (`/settings`)

All toggle buttons use `role="switch"` with `aria-checked`:

```html
<button role="switch" aria-checked="true" aria-label="Toggle wake word" ...>
```

Segmented controls use `aria-pressed`:

```html
<button aria-pressed="true" ...>Simulation</button>
```

### Guardian Page (`/guardian`)

- `role="group"` on scenario picker
- `aria-busy` on the run button while analysis is running
- `aria-label` on all interactive controls

### Navigation Page (`/navigation`)

- SVG route map has `aria-label="Route map — indoor navigation"` and `role="img"`
- Heading + distance announced via TTS every 10 seconds
- Crossing panel never says "safe to cross" — uses "appears clear, but please check carefully"

---

## Detail: Voice-First Controls

All essential session controls are available by voice command:

| Voice command | Action |
|---------------|--------|
| "Start session" / "Begin" | Starts the vision session |
| "Stop session" / "End" | Ends the session |
| "Repeat" / "Say again" | Repeats last guidance |
| "Emergency stop" / "Stop everything" | Stops all speech, ends session |
| "Help" | Emergency mode activated |
| "Describe" | Scene description |
| "Camera on" | Activates camera |
| "Camera off" | Stops camera |
| "What is ahead?" | Triggers analysis |

Voice commands are handled by `voiceCommandEngine.ts` (30+ intents) + `useVoiceCommands.ts`.

---

## Detail: One-Action Session Start

The session starts with a single "Start Session" button. The system:

1. Loads user settings from `localStorage`
2. Starts GPS and motion sensors (if enabled)
3. Calls `/api/sessions/start`
4. Announces "Ready. Scanning your surroundings." (or mode-appropriate message)
5. Begins 3-second frame loop

No configuration required for first use. Simulation mode is the default — no camera or API key needed.

---

## Detail: Emergency Control

The emergency stop button:
- Minimum size: 56 × 56 px (`min-h-[56px]`)
- Distinct red background (`bg-red-600`)
- `aria-label="Emergency stop"` 
- `role="button"` with visible focus ring
- Available in both walking mode overlay and normal session view
- Speaking voice command "Emergency stop" or "Help" triggers same action

---

## Detail: Keyboard Operation

All controls are keyboard-accessible:

- Tab order follows visual reading order
- Focus trap active during walking mode fullscreen overlay
- Emergency stop reachable via Tab → Enter
- No mouse-required interactions
- All dropdowns and selectors use native `<select>` or keyboard-accessible button groups

---

## Detail: Reduced Motion

When `reducedMotion = true` in Settings:
- `document.documentElement.classList.add('reduced-motion')` applied via `PWASetup`
- CSS: `@media (prefers-reduced-motion: reduce)` removes all transitions and animations
- `.reduced-motion` class disables spinner animations and scanning indicators

---

## Detail: High Contrast Mode

When `highContrastMode = true` in Settings:
- `document.documentElement.classList.add('high-contrast-mode')` applied via `PWASetup`
- Black/white palette: borders increased, text brightened
- All status indicators use text labels, not color alone

---

## Detail: Haptic Fallback

For hearing-impaired or earphone-free users:

| Alert level | Haptic pattern | Duration |
|-------------|---------------|---------|
| Critical | 3 × 200 ms pulses | 800 ms |
| High | 2 × 100 ms pulses | 400 ms |
| Medium | 1 × 100 ms pulse | 200 ms |
| Waypoint saved | 1 × 50 ms pulse | 100 ms |

Haptic requires `navigator.vibrate()` support (Chrome for Android). iOS is not supported due to browser limitations. The `vibrationEnabled` setting defaults to `true`.

---

## Detail: Offline Accessibility

Offline operation is fully accessible:

- `offline.html` speaks "You are offline" via browser TTS on load
- Auto-reloads when connection restores
- All guardian + hazard detection functions without internet
- Service worker (`sw.js`) caches essential assets for offline use
- Walking mode and emergency stop available offline

---

## Known Limitations

| Limitation | Severity | Notes |
|------------|----------|-------|
| iOS TTS rate/voice limited | Low | Safari Web Speech API is less configurable |
| iOS haptic not available | Medium | No `navigator.vibrate()` on iOS |
| Voice commands (STT) Chrome/Edge only | Medium | Safari and Firefox do not support SpeechRecognition API |
| Offline STT not implemented | Medium | WebAssembly Whisper planned; currently STT requires network in Chrome |
| Camera not available in all PWA contexts | Low | Some secure contexts restrict camera |

---

## Accessibility Preset Quick Reference

From the Accessibility page (`/accessibility`):

| Preset | Key changes |
|--------|------------|
| Screen Reader First | Brief messages, frequent updates, no visual dependence |
| Low Vision | High contrast, large text, visual indicators |
| Hearing Impaired | Haptic first, visual alerts, no audio required |
| Motor Impaired | Larger touch targets, extended timers, no time pressure |
| Cognitive Support | Simple messages, slow speech, minimal options |

---

*Validated by code inspection against source files in `denarixx/src/`. Not a substitute for user testing with real assistive technology.*
