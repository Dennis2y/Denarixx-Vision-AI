# V5 Voice-First Companion Mode

Phase 5 transforms Denarixx Vision AI from a dashboard into a calm human guide —
complete with hands-free voice controls, configurable guidance personality, last-guidance
memory, and an audio-first onboarding flow.

---

## Voice Commands

Supported in Chrome and Edge. Not available in Firefox or Safari.

| Say this                       | Action                          |
|--------------------------------|---------------------------------|
| "start session"                | Begin vision session            |
| "stop session"                 | End vision session              |
| "repeat" / "repeat that"       | Re-speak last guidance          |
| "describe surroundings"        | Narrate current scene           |
| "where am I"                   | Describe current location       |
| "what should I do"             | Read current recommended action |
| "save this place"              | Save current location to memory |
| "emergency" / "danger"         | Emergency stop                  |

Commands are case-insensitive and punctuation-tolerant. Say any recognizable variation
(e.g. "help" → "what should I do"; "abort" → "emergency stop").

---

## Guidance Personality

Set in **Settings → Guidance Personality**. Applies at next session start.

| Personality | Speaks           | Tone                          |
|-------------|------------------|-------------------------------|
| minimal     | Critical + high  | Terse, action-only            |
| balanced    | Medium and above | Standard messages (default)   |
| detailed    | All non-none     | Full descriptions included    |
| companion   | All non-none     | Warm, natural, calm reassurance |

### Companion mode reassurance

When companion mode is active and no alert has fired for ≥30 seconds, the system
speaks one reassurance message from a rotating set:

> "You're doing well. I'm watching your surroundings carefully."
> "All clear ahead. Take your time."
> "I'm here with you. Your path looks clear right now."

Reassurance never fires during active hazard periods.

### Companion message shaping

- Critical → unchanged (no softening of life-threatening alerts)
- High → "Heads up — …"
- Medium → "I can see something — …"
- Low → unchanged

---

## Last Guidance Memory

The **Last Guidance** panel on the Session page shows:

- Text of the most recent spoken guidance
- Risk level badge (color-coded)
- Confidence bar (0–100%)
- Reason why it was spoken
- Time since it was spoken
- **Repeat** button (or say "repeat")

`useLastGuidance` stores the record in a React ref so the repeat function always
reads the most recent value, even inside setInterval closures.

---

## Audio Settings

| Setting              | Default  | Description                              |
|----------------------|----------|------------------------------------------|
| Speech Rate          | 1.0      | 0.5 = slow, 1.0 = natural, 2.0 = fast   |
| Speech Volume        | 1.0      | 0 = silent, 1 = full                     |
| Alert Volume         | 1.0      | Separate volume for hazard alerts        |
| Voice               | System   | Any English voice from device            |
| Repeat Critical      | On       | Auto-repeat critical alerts after 10 s   |

Settings are stored in **localStorage** under `denarixx_settings` and applied
at the start of each session.

---

## Onboarding Flow

A 6-step audio-first modal shown on first visit to the Session page.

Each step auto-narrates when displayed. Users can advance with Next, go back,
or press Escape to skip.

| Step | Content                                                              |
|------|----------------------------------------------------------------------|
| 1    | Welcome — what Denarixx is                                          |
| 2    | Camera permission — how it works, simulation fallback               |
| 3    | Privacy — no storage, face recognition disabled                     |
| 4    | Safety disclaimer — assistive only, never certain about safety      |
| 5    | Voice commands — quick reference list                               |
| 6    | Ready — Test Speech + Start Demo buttons                            |

Stored in localStorage under `denarixx_onboarded`. Reset from Settings page.

---

## Engine Integration

```
useVoiceCommands
    │ onCommand
    ▼
session/page.tsx (command router)
    │
    ├── start_session / stop_session → useVisionSession.startSession / stopSession
    ├── repeat_last → useVisionSession.repeatLastGuidance()
    ├── describe_surroundings → speak(currentScene.summary)
    ├── where_am_i → speak("You are in: " + currentScene.summary)
    ├── what_should_i_do → speak(currentDecision.message)
    ├── save_this_place → saveMemoryEvent()
    └── emergency_stop → stopSession() + speak(emergency message)

useVisionSession (runFrame loop)
    │
    ├── GuidancePersonalityEngine.shouldSpeak(riskLevel, personality)
    │       └── silences alerts below personality threshold
    ├── GuidancePersonalityEngine.formatMessage(message, personality, riskLevel)
    │       └── applies tone shaping for companion / minimal
    ├── GuidancePersonalityEngine.shouldReassure(personality, secondsSinceAlert)
    │       └── companion mode: reassurance every 30+ s of quiet
    └── useLastGuidance.setGuidance(record)
            └── stores text, riskLevel, confidence, reason, timestamp
```

---

## File Map

| File | Role |
|------|------|
| `src/engines/voiceCommandEngine.ts` | Parse transcript → VoiceCommandType |
| `src/engines/guidancePersonalityEngine.ts` | Message shaping + shouldSpeak + reassurance |
| `src/lib/settingsStore.ts` | localStorage r/w, AppSettings type |
| `src/hooks/useVoiceCommands.ts` | Web Speech API continuous listener |
| `src/hooks/useLastGuidance.ts` | Last-guidance record + repeat |
| `src/hooks/useAudioGuidance.ts` | Priority-queued TTS, now rate/volume/voice configurable |
| `src/components/session/OnboardingFlow.tsx` | 6-step audio-first onboarding modal |
| `src/components/session/VoiceCommandIndicator.tsx` | Listening badge + last command |
| `src/components/session/LastGuidancePanel.tsx` | Last guidance display + repeat button |
| `src/app/settings/page.tsx` | Full settings UI with localStorage persistence |
| `src/hooks/useVisionSession.ts` | Session loop — integrated personality + last guidance |
| `tests/voiceCompanion.test.ts` | 50+ tests for engines (no browser required) |

---

## Tests

```bash
cd denarixx && npx tsx tests/voiceCompanion.test.ts
```

Covers:
- VoiceCommandEngine: 25 cases — start/stop, navigation, repeat/save/emergency, unknown, case/punctuation tolerance, label()
- GuidancePersonalityEngine: 30+ cases — shouldSpeak (all 4 personalities × 5 risk levels), formatMessage (all personalities), getReassurance, shouldReassure, getSilenceReason, reset()
