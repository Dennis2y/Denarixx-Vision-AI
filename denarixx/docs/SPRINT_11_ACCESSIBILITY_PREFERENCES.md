# Sprint 11 — Accessibility & Personal Preferences

## Overview

Sprint 11 introduces a comprehensive accessibility and personal preference system for Denarixx Vision AI. Every user can now fully personalise how the platform communicates, navigates, and assists them — and all settings automatically propagate through every engine layer.

---

## Architecture

### New files

| Path | Purpose |
|------|---------|
| `src/types/preferences.ts` | All preference types, enums, interfaces, and defaults |
| `src/engines/accessibilityEngine.ts` | Accessibility modes, presets, CSS class derivation, ARIA helpers |
| `src/engines/userPreferenceEngine.ts` | Save/load/validate/diff/bridge preferences |
| `src/engines/audioPreferenceEngine.ts` | Speech rate, volume, verbosity, repeat, silence, earcon logic |
| `src/engines/hapticPreferenceEngine.ts` | Vibration patterns, intensity scaling, routing |
| `src/app/accessibility/page.tsx` | Full Accessibility & Preferences page (Client Component) |
| `tests/accessibilityEngine.test.ts` | 130+ test suite across all 4 engines |
| `docs/SPRINT_11_ACCESSIBILITY_PREFERENCES.md` | This document |

---

## Preference hierarchy

```
UserPreferences (root, version-stamped)
├── accessibilityMode  — applies across all sub-groups via presets
├── personalityMode    — companion tone (→ Sprint 10)
├── audio              — speech rate, volume, verbosity, silence, earcons
├── haptic             — vibration intensity, event routing, patterns
├── navigation         — detail level, indoor/outdoor style, landmarks
├── alert              — frequency, sensitivity, repeat, low-risk filter
└── display            — contrast, text size, colour-blind palette, SR mode
```

### Priority resolution

When an **accessibility preset** is applied, it sets overrides across all groups. The user can then fine-tune individual settings within each group. Fine-tuned values persist independently — selecting a different preset later will overwrite them.

### Propagation to existing engines

`toAppSettings()` in `userPreferenceEngine.ts` bridges Sprint 11 preferences to the existing `AppSettings` shape used by `settingsStore.ts`:

| Preference | AppSettings field |
|------------|-----------------|
| `audio.speechRate` | `speechRate` |
| `audio.speechVolume` | `speechVolume` |
| `audio.guidanceVerbosity` | `alertVerbosity` (mapped: brief→minimal, verbose→full) |
| `personalityMode` | `guidancePersonality` |
| `alert.hazardSensitivity` | `hazardSensitivity` |
| `alert.criticalAlertRepeat` | `repeatCriticalAlerts` |
| `haptic.hapticEnabled` | `vibrationEnabled` |
| `display.highContrastMode` | `highContrastMode` |
| `display.reducedMotion` | `reducedMotion` |

---

## Accessibility modes

| Mode | Best for | Key overrides |
|------|----------|--------------|
| **Standard** | Sighted users | No changes |
| **Blind / No Vision** | No usable vision | Verbose audio, earcons, strong haptic, screen reader, spatial indoor nav, rich outdoor nav |
| **Low Vision** | Partial sight | High contrast, large text, colour-blind palette, enhanced audio |
| **Hearing Impaired** | Low/no hearing | Speech muted, max haptic, visual alerts prioritised |
| **One-Hand Operation** | Single-hand use | Large tap targets, simplified navigation |

---

## User preference engine

### Persistence

Preferences are stored in `localStorage` under key `denarixx_preferences_v1`. Storage is:
- **Client-side only** — all persistence methods are guarded by `typeof window !== 'undefined'`
- **Version-stamped** — migration hook handles older versions
- **Fault-tolerant** — `loadPreferences()` catches JSON parse errors and returns defaults

### Validation

`validatePreferences()` checks:
- `speechRate` must be 0.5–2.0
- `speechVolume` and `alertVolume` must be 0–1
- Warns if hearing-impaired mode has vibration off
- Warns if blind mode has zero speech volume

### Diff utility

`diffPreferences(a, b)` returns an array of `PreferenceChangeEvent` items, enabling reactive UI and targeted analytics without storing personal data.

---

## Audio preference engine

### Speech rate

| Label | Rate range |
|-------|-----------|
| Slow | ≤ 0.8× |
| Normal | 0.8–1.3× |
| Fast | ≥ 1.3× |

### Verbosity → sentence count

| Verbosity | Non-critical | Critical |
|-----------|-------------|---------|
| Brief | 1 | 3 |
| Normal | 2 | 3 |
| Verbose | 4 | 3 |

Critical alerts always generate 3 sentences regardless of verbosity.

### Earcon system

Short audio tones complement speech for high-speed hazard awareness:

| Level | Earcon |
|-------|--------|
| Critical | Three short beeps |
| High | Two short beeps |
| Medium | One beep |
| Low | Soft tone |
| Navigation | Ding |

---

## Haptic preference engine

### Vibration intensity multipliers

| Intensity | Multiplier |
|-----------|-----------|
| Off | 0× (no vibration) |
| Light | 0.5× |
| Medium | 1.0× |
| Strong | 1.5× |

### Built-in patterns

| Pattern | Timing (ms) | Use |
|---------|------------|-----|
| Critical Alert | 200–100–200–100–400 | Critical hazard |
| High Alert | 200–100–200 | High-priority hazard |
| Medium Alert | 150–100–150 | Medium hazard |
| Navigation Turn | 100–50–100 | Turn instruction |
| Reassurance | 80 | Companion message |
| Crossing Warning | 300–100–300–100–300 | Road crossing |

### Routing rules

| Event type | Trigger |
|-----------|---------|
| Critical / High | `hapticForCritical: true` |
| Medium | `hapticForCritical: true` (inherits) |
| Navigation | `hapticForNavigation: true` |
| Reassurance | `hapticForReassurance: true` |
| Low | Never — always suppressed |

---

## Accessibility page

The `/accessibility` page is a **Client Component** (`'use client'`) with tabbed sections:

| Tab | Contents |
|-----|----------|
| Presets | 5 accessibility preset cards + companion personality selector |
| Voice | Speech rate, volume, verbosity, repeat, silence, earcon toggle |
| Navigation | Detail level, indoor style, outdoor style, distance unit, toggles |
| Alerts | Frequency, sensitivity, critical repeat, silent low-risk |
| Haptic | Enable toggle, intensity, event routing, pattern library |
| Display | Contrast mode, text size, high contrast, reduced motion, colour-blind, SR |

All changes are reflected immediately in the live summary bar at the top. A "Save preferences" button persists to localStorage. "Reset to defaults" restores factory settings.

---

## Accessibility principles

1. **Audio-first design** — all information conveyed via speech; visual UI is supplementary.
2. **No visual-only cues** — status changes always have an audio or haptic counterpart.
3. **ARIA completeness** — every interactive element has `aria-label`, `role`, and `aria-pressed`/`aria-selected`/`aria-checked` as appropriate.
4. **Screen reader regions** — `aria-live` is set to `assertive` for blind mode and `off` for hearing-impaired.
5. **Colour independence** — colour-blind palette is available; status is never communicated by colour alone.
6. **One-hand friendliness** — tap targets scale to `min-h-14` for one-hand and large-text modes.
7. **Privacy by default** — all preferences stored locally; `PREFERENCES_PRIVACY_NOTE` constant is exported for UI display.

---

## Integration points

| Sprint | Connection |
|--------|-----------|
| Sprint 10 (Companion Personality) | `personalityMode` preference feeds `guidancePersonalityEngine.ts` |
| Sprint 9 (Explainable AI & Trust) | `confidenceAnnouncements` controls trust transparency |
| Sprint 8 (Long-Term Memory) | Display preferences persist through `toAppSettings()` |
| Sprint 5 (Guardian Alert Quality) | `alertFrequency` and `hazardSensitivity` feed `alertQualityEngine.ts` |
| Sprint 3 (V3 Reasoning) | `guidanceVerbosity` controls sentence count in reasoning output |
| V7 (Sensor Fusion) | `vibrationEnabled` from `toAppSettings()` controls sensor vibration |
| V13 (Navigation) | `navigationDetail`, `indoorGuidanceStyle`, `outdoorGuidanceStyle` |

---

## Future hardware compatibility

| Hardware | Preference mapping |
|----------|------------------|
| Denarixx Vision Glasses (V16) | Bone-conduction volume ← `audio.speechVolume`; haptic ← `haptic` group |
| Smart glasses IMU | Motion-triggered silence ← `automaticSilence: 'auto'` |
| External BLE earbuds | Voice name ← `audio.voiceName` for device-specific TTS voice |
| Haptic wristband | Pattern library maps directly to wristband motor commands |

---

## Tests

`tests/accessibilityEngine.test.ts` — full coverage across all 4 engines:

- **Section 1:** Preset registry and lookup (6 tests)
- **Section 2:** Apply preset (11 tests)
- **Section 3:** CSS class derivation (12 tests)
- **Section 4:** ARIA helpers (10 tests)
- **Section 5:** User preference engine (24 tests)
- **Section 6:** Audio preference engine (27 tests)
- **Section 7:** Haptic preference engine (17 tests)
- **Section 8:** Integration across engines (10 tests)

Run: `cd denarixx && npx tsx tests/accessibilityEngine.test.ts`
