# Sprint 13 — Multi-Language AI Engine

## Overview

Sprint 13 adds comprehensive multi-language support to Denarixx Vision AI, enabling the system to communicate naturally with users in 8 languages while keeping the safety system language-independent.

## Supported Languages

| Code | Language   | Native Name | Script | Region |
|------|-----------|-------------|--------|--------|
| `en` | English   | English     | Latin  | GB     |
| `de` | German    | Deutsch     | Latin  | DE     |
| `fr` | French    | Français    | Latin  | FR     |
| `es` | Spanish   | Español     | Latin  | ES     |
| `it` | Italian   | Italiano    | Latin  | IT     |
| `pt` | Portuguese| Português   | Latin  | PT     |
| `ar` | Arabic    | العربية     | Arabic (RTL) | SA |
| `sw` | Swahili   | Kiswahili   | Latin  | KE     |

Architecture uses a `SupportedLanguage` union type — adding a new language requires: (1) adding the code to the union, (2) registering it in `LANGUAGE_REGISTRY`, (3) adding voice options to `VOICE_OPTIONS`, and (4) adding translations to `PHRASE_DICTIONARY`.

---

## Architecture

### 1. Language Detection Engine (`languageDetectionEngine.ts`)

Detects the user's language from three sources in priority order:

1. **Browser locale** (`navigator.language`, `navigator.languages`) — 95% confidence for known locales.
2. **Text analysis** — frequency analysis of language-specific function words; Arabic detected via Unicode range `\u0600–\u06FF`.
3. **Fallback** — returns English when no signal is available.

All detection is pure/synchronous — no network requests.

### 2. Language Engine (`languageEngine.ts`)

Core registry and preference management:

- `LANGUAGE_REGISTRY` — static metadata for all 8 languages (name, native name, flag, BCP-47 tag, RTL flag).
- Preference lifecycle: `createDefaultPreferences`, `validatePreferences`, `setPreferredLanguage`, `applyAutoDetect`.
- RTL helpers: `isRTL`, `getTextDirection`, `getCssClass`.
- Immutable pattern: all functions return new objects; originals are never mutated.

**Guardian language lock:** `guardianLanguage` is always `'en'` and cannot be changed. Safety decisions are generated in English and translated for presentation only.

### 3. Translation Engine (`translationEngine.ts`)

Phase 1 uses a built-in phrase dictionary (`PHRASE_DICTIONARY`) with ~30 phrases translated into all 8 languages. Categories:

- Hazard alerts (time-critical)
- Navigation instructions
- Scene descriptions
- Companion speech
- Memory summaries
- AI explanations & trust messages
- Settings labels

**Safety guarantee:** `translateHazardAlert()` resolves synchronously from the dictionary. The function never awaits a network request, ensuring zero translation latency on critical alerts.

**Fallback:** When a phrase is not in the dictionary, the original English text is returned unchanged. This is always safe — the Guardian output is always in English.

**Future:** Replace the dictionary look-up with an on-device LLM translation step (see below).

### 4. Speech Language Engine (`speechLanguageEngine.ts`)

Manages per-language voice configurations:

- `VOICE_OPTIONS` — 2–3 simulated voices per language (name, gender, style).
- `switchVoiceForLanguage()` — automatically assigns the default voice for a new language when `autoSwitchVoice` is true.
- `buildSpeechUtteranceConfig()` — produces the config object for Web Speech API calls (BCP-47 tag, pitch, rate, volume).
- `adjustRateForAccessibility()` — slow (0.75×), normal (1.0×), fast (1.35×).
- `clampVoicePreference()` — enforces pitch 0.5–2.0, rate 0.5–2.0, volume 0.0–1.0.

---

## Translation Pipeline

```
User Input (any language)
        ↓
Language Detection Engine
        ↓
Preferred Language set in LanguagePreferences
        ↓
Cognitive Guardian
  → Always generates decision in English
  → translateHazardAlert() / translateText() called AFTER decision
        ↓
Speech Language Engine
  → buildSpeechUtteranceConfig()
  → Web Speech API (browser TTS)
        ↓
User hears guidance in their language
```

### Safety considerations

1. **No translation delay on critical path.** The Guardian generates a decision in English. The translation is a presentation-layer concern — it happens after the decision is final.
2. **Dictionary-only for critical alerts.** `translateHazardAlert()` uses only `PHRASE_DICTIONARY`. It will never hang waiting for a network response.
3. **English fallback.** If a phrase is not in the dictionary, the English original is spoken. This is always intelligible and safe.
4. **Guardian language is immutable.** `LanguagePreferences.guardianLanguage` is typed as `'en'` — it cannot be set to any other value by any code path.

---

## Future LLM Translation Integration

When a production LLM translation service is integrated, the recommended pattern is:

```typescript
// Phase 2 translation (not in Sprint 13)
async function translateWithLLM(input: TranslationInput): Promise<TranslationOutput> {
  if (input.isCritical) {
    // Always use dictionary for critical alerts — no async
    return translateText(input);
  }
  // LLM translation for non-critical content
  const result = await llmProvider.translate(input.text, input.targetLanguage);
  return { ...result, wasSimulated: false };
}
```

The `wasSimulated: boolean` field in `TranslationOutput` allows the UI to indicate whether a phrase came from the built-in dictionary or a live translation service.

---

## Language Settings Page (`/language`)

Four-tab interface:

| Tab | Content |
|-----|---------|
| **Language** | 8 language cards with flags; click to select |
| **Voice** | Voice selector, pitch, rate, volume sliders; auto-switch toggle |
| **Preview** | Live translation preview for scene, hazard, navigation, companion |
| **Test** | Fire test phrases and hear them spoken in the selected language |

---

## Privacy

- All translation runs locally using the built-in phrase dictionary.
- No text is sent to external servers in Phase 1 (simulation mode).
- The `LANGUAGE_PRIVACY_NOTE` constant is displayed in the UI.
- Language preferences are stored in-memory only (no persistent server storage in Phase 1).

---

## Tests

`tests/languageEngine.test.ts` — 120 tests covering:

- Language detection (locale, text analysis, Arabic script, language list)
- Language registry (all 8 languages, RTL, BCP-47, flags)
- Preference management (create, validate, update, auto-detect, diff)
- Translation (all contexts, fallback, batch, RTL formatting)
- Voice management (registry, default selection, voice switching, utterance config)
- Accessibility rate adjustment and value clamping
- End-to-end integration scenarios (Guardian pipeline, Arabic RTL, Swahili navigation)

---

## Roadmap Position

- **Phase 5: Expanded Access** — Sprint 23 (first sprint in this phase)
- Prerequisite: Phase 1 (Safety Core), Phase 2 (Context & Trust) complete
- Enables: multi-lingual companion, localised navigation, accessible onboarding in 8 languages
