# Sprint 10 — Adaptive Companion Personality

## Overview

Sprint 10 makes Denarixx Vision AI adapt naturally to each user and their environment. Four distinct personality modes, three speech rates, brief/verbose output, automatic context detection, and a feedback-adjusted trust pipeline work together to ensure every user gets guidance at the right level, in the right tone, at the right time.

---

## Architecture

### Types (`src/types/companion.ts`)

Separate from all other type files. Key types:

| Type | Values |
|------|--------|
| `PersonalityMode` | `minimal \| balanced \| detailed \| companion` |
| `SpeechRate` | `slow \| normal \| fast` |
| `SpeechAmount` | `brief \| normal \| verbose` |
| `AlertFrequency` | `low \| medium \| high` |
| `NavigationDetail` | `minimal \| standard \| rich` |
| `ConfidenceAnnouncements` | `always \| when_low \| never` |
| `ContextType` | `indoor \| outdoor \| crossing \| crowded \| quiet \| poor_lighting \| unknown` |

Key interfaces: `CompanionProfile`, `ContextSnapshot`, `AdaptedGuidance`, `StyleOutput`, `SpeechAdaptation`, `PersonalityDescriptor`, `ContextAdaptationRule`.

---

### Engines

All four engines are **pure functional — no async, no I/O**. They complement (not replace) the existing `GuidancePersonalityEngine` class from Sprint 5.

#### `companionPersonalityEngine.ts`

Central orchestrator. Key functions:

| Function | Purpose |
|----------|---------|
| `createProfile(overrides?)` | Returns a `CompanionProfile` from defaults + overrides |
| `updateProfile(profile, changes)` | Immutable update |
| `personalityAllowsRisk(mode, riskLevel)` | Risk threshold gate |
| `isCriticalOverride(riskLevel)` | Always true for `critical` |
| `adaptMessage(input)` | Full pipeline: gate → style → speech → `AdaptedGuidance` |
| `shouldGiveReassurance(mode, seconds)` | Companion + 30s idle → true |
| `shouldAnnounceConfidence(profile, conf)` | Respects `confidenceAnnouncements` setting |
| `buildPreviewSample(mode)` | Returns example text for UI preview |

Risk threshold matrix:

| Mode | Threshold |
|------|-----------|
| Minimal | critical + high only |
| Balanced | medium and above |
| Detailed | all except none |
| Companion | all except none |

Safety overrides:
- `critical` always bypasses all filters regardless of mode
- `isCrossing` context forces `minimal` → `balanced` upgrade

#### `guidanceStyleEngine.ts`

Formats messages by mode and context. Key functions:

| Function | Purpose |
|----------|---------|
| `applyGuidanceStyle(input)` | Returns `StyleOutput` for given mode + context |
| `formatNavigationGuidance(...)` | Navigation-specific formatting |
| `buildMemoryGreeting(mode, facts)` | Companion/detailed welcome with memory fact |
| `frameUncertainty(message, conf, mode)` | Adds hedge for low-confidence (except minimal) |

Style behaviours:

| Mode | Behaviour |
|------|-----------|
| Minimal | First sentence only, terse tone, no suffix |
| Balanced | 2 sentences, neutral, context suffix added |
| Detailed | Full message, context-aware framing |
| Companion | Warm prefix (medium/low), direct (critical/high), reassurance flag |

#### `speechAdaptationEngine.ts`

Controls speech rate, brevity, and repeat timing. Key functions:

| Function | Purpose |
|----------|---------|
| `resolveRate(profileRate, risk, ctx)` | Slow → normal for critical; fast → normal for crossings |
| `adaptSpeech(input)` | Full `SpeechAdaptation` bundle |
| `applyBrevity(text, adaptation)` | Trims text to `maxSentences` in brief mode |
| `repeatDelayMs(risk, autoRepeat)` | critical → 8s, high → 15s, else null |

`SPEECH_RATE_MAP`: `{ slow: 0.75, normal: 1.0, fast: 1.4 }`

#### `contextAwarenessEngine.ts`

Classifies environment and applies adaptation rules. Key functions:

| Function | Purpose |
|----------|---------|
| `classifyContext(detections, scene, sensorIndoors?)` | Returns `ContextType` |
| `buildContextSnapshot(detections, scene, options)` | Returns full `ContextSnapshot` |
| `getAdaptationRule(contextType)` | Returns `ContextAdaptationRule` |
| `adjustAlertFrequency(base, rule)` | Scales alert frequency by context boost |
| `contextTypeLabel(type)` | Human-readable label |
| `contextTypeIcon(type)` | Emoji icon |

Context detection priority: **crossing > poor_lighting > crowded > indoor/outdoor > quiet > unknown**

Context adaptation rules:

| Context | Frequency boost | Force detail | Safety override |
|---------|----------------|-------------|-----------------|
| Crossing | 2.0× | ✓ | ✓ |
| Poor lighting | 1.5× | ✓ | ✗ |
| Crowded | 1.5× | ✗ | ✗ |
| Outdoor | 1.2× | ✗ | ✗ |
| Indoor | 1.0× | ✗ | ✗ |
| Quiet | 0.8× | ✗ | ✗ |

---

### UI — Companion Settings Page (`/companion`)

Full settings page with:

| Section | Options |
|---------|---------|
| Personality Mode | 4 cards with description + example quote |
| Speech Rate | Slow / Normal / Fast |
| Speech Amount | Brief (1 sentence) / Normal (2) / Verbose (4) |
| Alert Frequency | Low / Medium / High |
| Navigation Detail | Minimal / Standard / Rich |
| Confidence Announcements | Always / Only when uncertain / Never |
| Behaviour Options | Auto-repeat critical alerts toggle |
| Context Adaptation | Read-only explanation panel |
| Privacy | COMPANION_PRIVACY_NOTE |
| Preview | Speaks sample via Web Speech API; auto-preview option |

Settings persist to `localStorage` via `settingsStore`. `guidancePersonality`, `speechRate`, and `alertVerbosity` are mapped from `CompanionProfile` to the existing `AppSettings` on save.

---

## Decision Flow

```
Frame received
    ↓
contextAwarenessEngine.buildContextSnapshot(detections, scene)
    ↓
companionPersonalityEngine.adaptMessage({
    message, riskLevel, profile, context
})
    ├── personalityAllowsRisk() — gate
    ├── guidanceStyleEngine.applyGuidanceStyle() — format
    └── speechAdaptationEngine.adaptSpeech() — speech params
    ↓
AdaptedGuidance { adaptedMessage, speechRate, shouldSpeak, ... }
    ↓
speak(adaptedMessage, rate) — if shouldSpeak
    ↓
ExplanationPanel — records decision (Sprint 9 trust layer)
```

---

## Safety Invariants

1. `critical` risk **always** speaks regardless of personality mode.
2. `isCrossing` context upgrades `minimal` → `balanced` for safety.
3. `resolveRate` never allows `slow` for critical alerts.
4. `resolveRate` downgrades `fast` → `normal` at crossings.
5. Navigation guidance always passes the risk gate (`isNavigation: true`).

---

## Integration with Other Systems

| System | How Sprint 10 connects |
|--------|----------------------|
| Guardian (Sprint 5) | `adaptMessage` replaces/wraps `GuidancePersonalityEngine.shouldSpeak + formatMessage` |
| Navigation (Sprint 13) | `formatNavigationGuidance` respects `NavigationDetail` setting |
| Long-Term Memory (Sprint 8) | `buildMemoryGreeting` uses recalled facts in companion/detailed mode |
| Explainable AI (Sprint 9) | `adaptMessage` result includes `personalityApplied` + `contextApplied` for `ExplanationPanel` |
| Trust Engine (Sprint 9) | `shouldAnnounceConfidence + formatConfidenceNote` use `TrustScore.score` |
| Settings (`settingsStore`) | Companion Settings page maps `CompanionProfile` → `AppSettings` on save |

---

## Context Adaptation Examples

| Situation | Effect |
|-----------|--------|
| Crossing a road | Frequency ×2, adds "Please check carefully", minimal → balanced |
| Poor lighting at night | +1 verbosity, adds "Low lighting — take extra care" |
| Crowded area | −1 verbosity for cognitive load reduction |
| 30s of quiet (companion mode) | Reassurance spoken: "You're doing well — I'm watching." |
| Low-confidence detection + `when_low` | Appends "(Moderate confidence.)" |

---

## Privacy Model

- `COMPANION_PRIVACY_NOTE`: settings stored locally, no speech data sent externally
- No voice data, biometrics, or audio recordings stored
- All engines are pure — zero side effects, zero I/O

---

## Future: LLM Integration (Phase 2)

In Phase 2, the companion engine could be extended with a small on-device LLM to:
- Personalise message phrasing beyond templates
- Recall multi-turn conversational context
- Generate location-aware memory greetings dynamically
- Fine-tune style based on accumulated feedback (from Sprint 9 trust system)
- Localise guidance to non-English speakers

The pure functional architecture makes this straightforward: swap `applyGuidanceStyle` with an LLM-backed implementation while keeping all safety invariants in the surrounding pipeline.

---

## Files

| File | Purpose |
|------|---------|
| `src/types/companion.ts` | All Sprint 10 types |
| `src/engines/companionPersonalityEngine.ts` | Core pipeline orchestrator |
| `src/engines/guidanceStyleEngine.ts` | Message formatting by mode + context |
| `src/engines/speechAdaptationEngine.ts` | Rate, brevity, repeat timing |
| `src/engines/contextAwarenessEngine.ts` | Context detection + adaptation rules |
| `src/app/companion/page.tsx` | Companion Settings UI |
| `tests/companionPersonality.test.ts` | Test suite |
| `docs/SPRINT_10_ADAPTIVE_COMPANION.md` | This document |
