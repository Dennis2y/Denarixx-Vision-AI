# V10: Mobile Deployment Readiness

## Overview

Phase 10 prepares Denarixx Vision AI for real-world deployment on Android and iPhone. It adds full PWA (Progressive Web App) support, mobile accessibility improvements, reliability features, and a mobile walking mode — making the app installable, offline-capable, and screen-reader friendly.

---

## What Was Built

### 1. PWA Support (`src/lib/pwa.ts`, `public/sw.js`, `public/manifest.json`)

**Service Worker** (`public/sw.js`)
- Cache-first strategy for static assets
- Network-first with offline fallback for page navigation
- JSON stub response for `/api/*` calls when offline
- Auto-precaches `/`, `/session`, `/settings`, `/offline.html`
- Old cache purge on activate

**Web App Manifest** (`public/manifest.json`)
- `display_override: ["standalone", "minimal-ui", "browser"]` for broad Android/iOS support
- Shortcuts to `/session` (Start Vision Session) and `/settings`
- Portrait orientation lock
- `start_url: "/session"` — opens directly to the active session on launch
- `prefer_related_applications: false`

**Offline Fallback** (`public/offline.html`)
- Speaks "You are offline" via Web Speech API for screen reader / blind users
- Auto-reloads when `online` event fires
- Large touch target "Try again" button

**PWA Utilities** (`src/lib/pwa.ts`)
- `registerServiceWorker()` — registers SW, safe on SSR
- `isInstalledPWA()` — detects standalone display mode (Android + iOS)
- `getPWADisplayMode()` — `'standalone'` | `'browser'`
- `shouldShowInstallPrompt()` — combined guard
- `isOffline()` — `!navigator.onLine`, SSR-safe
- `getConnectionQuality()` — uses Network Information API, degrades gracefully
- `connectionLabel()` — human-readable quality label
- `classifyBatteryLevel()` — `critical` (≤10%) | `low` (≤20%) | `ok`
- `batteryWarningMessage()` — spoken warning with percent, or null if ok
- `checkCapabilities()` — camera, speech, SW, vibration, speechRecognition
- `missingCapabilities()` — returns list of missing-capability strings

**Install Hook** (`src/hooks/usePWAInstall.ts`)
- Captures `beforeinstallprompt` event
- Tracks `online` / `offline` / `appinstalled` events
- `canInstall`, `isInstalled`, `isOffline`, `promptInstall()` state

**PWASetup Component** (`src/components/PWASetup.tsx`)
- Registers SW on mount
- Applies `high-contrast-mode` / `reduced-motion` CSS classes from settings
- Shows sticky offline banner (`role="alert"`, `aria-live="assertive"`)
- Shows install-to-home-screen banner (session-scoped dismissal)

---

### 2. Mobile Accessibility

#### CSS (`globals.css`)
- `@media (prefers-contrast: more)` — increases contrast for system high-contrast mode
- `@media (prefers-reduced-motion: reduce)` — disables animations
- `.high-contrast-mode` — explicit CSS class (settable via Settings toggle)
- `.reduced-motion` — explicit CSS class for manual override
- Minimum `48px` touch target height via `.touch-target` utility

#### Settings Page (`/settings`)
- **High Contrast Mode** toggle (applies CSS class globally via `PWASetup`)
- **Reduced Motion** toggle (disables transitions globally)
- **Fullscreen Walking Mode** toggle (auto-enters fullscreen when session starts)
- **PWA Install** button — shows when `canInstall` is true

#### Layout
- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` meta tags
- Viewport with `viewport-fit=cover` for iPhone notch/safe-area support
- `PWASetup` client component wired in as first child of `<body>`

---

### 3. Mobile Reliability

#### Battery Warning (`/session`)
- Reads `sensorContext.battery.level` (V7 sensor integration)
- Shows dismissible warning banner when battery < 15%
- Spoken alert when warning appears
- `classifyBatteryLevel` / `batteryWarningMessage` from `src/lib/pwa.ts`

#### Offline Warning
- `PWASetup` offline banner appears across all pages
- Session page additionally shows inline "Offline — simulation active" notice
- API routes return `{ error: 'offline' }` JSON stub from SW

#### Permission Recovery
- Camera panel already shows retry button (V2 camera integration)
- Session page adds explicit "Permission denied" retry guidance in camera panel
- Sensor permission buttons already in `SensorStatusPanel` (V7)

---

### 4. Mobile Session Mode (Walking Mode)

#### Full-screen Walking Overlay (`/session`)
- Triggered by **🚶 Walking Mode** button (available during active session)
- Full-viewport dark overlay with:
  - Large **⛔ Emergency Stop** button (min 72px, spoken on press)
  - **🔁 Repeat Last Guidance** button
  - Live camera status pill
  - Battery warning if low
  - **✕ Exit Walking Mode** button
- Auto-enters on session start when `fullscreenWalkingMode` setting is enabled
- `aria-modal="true"`, `role="dialog"`, focus trapped inside
- Requests native fullscreen when possible (`requestFullscreen`)

#### Emergency Stop
- Also available on main session page as a large red button during active sessions
- Calls `stopSession()` and speaks "Session stopped"

---

### 5. Guardian Page — Aria Improvements

- Main pipeline results section: `aria-live="polite"` for live updates
- Scenario picker: `role="group"` + `aria-label`
- Pipeline timing section: `aria-label` per stage
- Run button: `aria-busy` while pipeline is executing

---

## Settings Added (V10)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `highContrastMode` | boolean | false | Apply high-contrast CSS class |
| `reducedMotion` | boolean | false | Disable all CSS transitions |
| `fullscreenWalkingMode` | boolean | false | Auto-enter fullscreen when session starts |

---

## Files Created / Modified

| File | Status |
|------|--------|
| `src/lib/pwa.ts` | New |
| `src/hooks/usePWAInstall.ts` | New |
| `src/components/PWASetup.tsx` | New |
| `public/sw.js` | New |
| `public/offline.html` | New |
| `public/manifest.json` | Updated |
| `src/lib/settingsStore.ts` | Updated (V10 settings) |
| `src/app/globals.css` | Updated (high contrast, reduced motion) |
| `src/app/layout.tsx` | Updated (PWASetup, iOS meta tags, viewport) |
| `src/app/session/page.tsx` | Updated (walking mode, emergency stop, battery/offline warnings) |
| `src/app/settings/page.tsx` | Updated (V10 accessibility section) |
| `src/app/guardian/page.tsx` | Updated (aria improvements) |
| `tests/mobileReadiness.test.ts` | New (62 tests) |
| `docs/V10_MOBILE_DEPLOYMENT_READINESS.md` | New |
| `docs/MOBILE_TESTING_CHECKLIST.md` | New |

---

## Test Coverage

- `tests/mobileReadiness.test.ts` — 62 tests across all pure utility functions in `pwa.ts`
- All V1–V9 test suites unaffected and still passing (596 total tests prior to V10)

---

## Architecture Notes

- **SSR safety:** All browser API calls in `pwa.ts` and `usePWAInstall.ts` are guarded with `typeof window` / `typeof navigator` checks.
- **Service worker scope:** `/` — covers all app routes.
- **Cache strategy:** Assets cached indefinitely; cache version bump (`denarixx-v10` → `denarixx-v11`) on next release purges stale entries.
- **Walking mode:** Implemented as React overlay, not native Fullscreen API (which has limited CSS control on iOS). Native fullscreen is attempted as a best-effort enhancement.
- **Battery data:** Sourced from V7 `useDeviceSensors` hook already integrated into session.

---

## Known Limitations

- **iOS PWA install:** iPhone requires the user to manually tap "Add to Home Screen" in Safari — `beforeinstallprompt` is not supported on iOS. The install banner explains this for iOS users.
- **Service worker on iOS:** Safari supports SW from iOS 11.3+ but behaviour differs from Chrome (no push notifications, limited background sync).
- **Speech recognition:** Works in Chrome on Android. Not available in Safari without a workaround.
- **Fullscreen API on iOS:** `requestFullscreen()` is not available on iOS Safari — the overlay covers the viewport instead.
