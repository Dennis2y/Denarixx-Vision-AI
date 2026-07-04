# Mobile Testing Checklist — Denarixx Vision AI (V10)

Use this checklist before any public release or major update. Tick each item on both platforms.

---

## Android Chrome Testing

### Installation
- [ ] Visit app URL in Chrome
- [ ] "Add to Home Screen" / install banner appears after first visit
- [ ] App installs and opens from home screen in standalone mode (no browser chrome)
- [ ] Splash screen appears on cold launch
- [ ] App icon appears correctly on home screen

### Session — Camera
- [ ] Tap "Start Camera" → browser requests camera permission
- [ ] Permission granted → live video appears, "LIVE" badge shows
- [ ] Permission denied → simulation mode activates with clear explanation
- [ ] Stop Camera → camera stops, simulation continues
- [ ] Re-tap Start Camera → permission prompt re-appears (if previously denied, OS settings must be opened)

### Session — Audio
- [ ] "Start Vision Session" → spoken guidance begins within 5 seconds
- [ ] Speech rate and volume match settings
- [ ] Critical alert → speech interrupts current guidance
- [ ] "Repeat Guidance" button → last guidance spoken again
- [ ] Voice commands: say "start session", "stop session", "repeat" → correct actions

### Session — Walking Mode
- [ ] Tap "🚶 Walking Mode" → full-screen overlay appears
- [ ] Emergency Stop button visible and large (min 72px)
- [ ] Tap Emergency Stop → session ends, spoken confirmation
- [ ] Repeat Guidance button works inside overlay
- [ ] "✕ Exit Walking Mode" closes overlay without stopping session
- [ ] Battery warning visible if battery < 15%

### Session — Vibration
- [ ] Critical alert → device vibrates (if enabled in Settings)
- [ ] Haptic alerts toggle in Settings → vibration enabled/disabled correctly

### Sensors
- [ ] GPS permission requested when enabled in Settings
- [ ] Motion sensors active during session (accelerometer, compass)
- [ ] Battery level shown in SensorStatusPanel
- [ ] Low battery warning appears at < 15%

### Offline
- [ ] Turn off WiFi/data during session → offline banner appears
- [ ] Simulation continues (no crash)
- [ ] API calls return gracefully (no unhandled error)
- [ ] Navigate to `/offline.html` directly → offline page speaks message
- [ ] Reconnect → online banner disappears

### Accessibility — Android TalkBack
- [ ] Enable TalkBack (Settings → Accessibility → TalkBack)
- [ ] All buttons have spoken labels (no "unlabelled button")
- [ ] Nav links read correctly
- [ ] Camera status badge announced on change
- [ ] Session controls announced
- [ ] Emergency Stop button announced as "Emergency stop, stop session"
- [ ] Skip to main content link works

---

## iPhone Safari Testing

### Installation
- [ ] Visit app URL in Safari
- [ ] Share menu → "Add to Home Screen" → install
- [ ] App opens from home screen in standalone mode
- [ ] Status bar colour matches theme (#030712)

### Session — Camera
- [ ] Camera permission prompt appears
- [ ] `playsInline` video plays correctly (no fullscreen hijack)
- [ ] Simulation fallback works

### Session — Audio
- [ ] Speech synthesis works (system voice)
- [ ] Audio plays after first user gesture (iOS audio unlock handled)
- [ ] "Repeat Guidance" button works

### Session — Walking Mode
- [ ] Walking mode overlay appears correctly on iPhone screen size
- [ ] Safe area / notch not obscuring buttons (viewport-fit=cover)
- [ ] Emergency Stop accessible with one thumb

### Offline
- [ ] Offline banner appears when disconnected
- [ ] offline.html speaks message (may require user gesture on iOS)

### Accessibility — iOS VoiceOver
- [ ] Enable VoiceOver (Settings → Accessibility → VoiceOver)
- [ ] Swipe through all interactive elements — all labelled
- [ ] Form controls in Settings announced correctly
- [ ] Toggle switches announced as "switch, on/off"
- [ ] Camera status announced on change (`aria-live="polite"`)
- [ ] Alerts announced immediately (`aria-live="assertive"`)
- [ ] Focus trap in Walking Mode overlay works

---

## Cross-Platform Accessibility

### Keyboard Navigation
- [ ] Tab key moves focus through all interactive elements in logical order
- [ ] Enter / Space activates buttons and toggles
- [ ] Escape closes overlays
- [ ] Focus ring visible (3px yellow outline)
- [ ] Skip to main content link works (Tab from address bar)

### High Contrast Mode
- [ ] OS high-contrast mode enabled → contrast rules applied
- [ ] Settings → High Contrast Mode toggle → CSS class applied immediately
- [ ] Text readable against backgrounds
- [ ] Focus rings clearly visible

### Reduced Motion
- [ ] OS prefers-reduced-motion enabled → animations disabled
- [ ] Settings → Reduced Motion toggle → transitions disabled
- [ ] Pulse animations on status dots suppressed

---

## Battery Testing

- [ ] Battery at 100% → no warning shown
- [ ] Battery at 15% → low battery warning banner appears
- [ ] Battery at 10% → "critically low" warning and spoken alert
- [ ] Battery-aware mode reduces frame scan interval (Settings option)

---

## Speech Output Testing

- [ ] All spoken text is intelligible at 1.0× rate
- [ ] Critical alerts interrupt lower-priority speech
- [ ] Speech rate 0.5× (slow) works correctly
- [ ] Speech rate 2.0× (fast) works correctly
- [ ] "Minimal" personality → only critical/high alerts spoken
- [ ] "Companion" personality → warm tone, more frequent guidance
- [ ] Voice selection in Settings → chosen voice applied in session

---

## Service Worker / PWA Testing

- [ ] Open DevTools → Application → Service Workers → `sw.js` registered
- [ ] Cache Storage → `denarixx-v10` cache populated after first load
- [ ] Simulate offline in DevTools → `/session` loads from cache
- [ ] Hard reload (`Ctrl+Shift+R`) → SW skips wait and activates new version
- [ ] New SW version deployed → old cache (`denarixx-v9`) deleted on activate

---

## Notes for Testers

- **Simulation mode:** When camera is not started or denied, all AI output is simulated. This is correct and expected behaviour.
- **Voice commands (Chrome only):** `webkitSpeechRecognition` is not available in Firefox or Safari. Voice Command Indicator will show "not supported".
- **iOS audio:** On iOS, audio requires a user gesture first. Tap anywhere before starting a session if speech does not begin.
- **GPS fuzzing:** Default location precision is "Fuzzy" (~1 km grid). Only enable "Precise" if location memory is also enabled.
- **SW update cycle:** After deploying a new version, open the app, then close all tabs and reopen to activate the new SW.
