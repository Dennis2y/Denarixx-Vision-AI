# V4 Real Vision Provider System

Phase 4 of Denarixx Vision AI adds a real AI vision provider system to the
`/api/vision/analyze-frame` endpoint. Simulation remains the default and is
always available as a fallback.

---

## Provider Selection

Set the `VISION_PROVIDER` environment variable (Replit secret):

| Value        | Provider                  | API Key Required      |
|--------------|---------------------------|-----------------------|
| `simulation` | SimulationVisionProvider  | None (default)        |
| `openai`     | OpenAIVisionProvider      | `OPENAI_API_KEY`      |
| `gemini`     | GeminiVisionProvider      | `GEMINI_API_KEY` (Phase 5) |
| `local`      | LocalVisionProvider       | `LOCAL_VISION_ENDPOINT` (Phase 5) |

---

## Provider Architecture

```
VISION_PROVIDER env var
        │
        ▼
visionProviderFactory.ts
  createVisionAnalysisProvider()
        │
        ├── simulation → SimulationVisionProvider
        │                 wraps MockVisionProvider, pure synthetic data
        │
        ├── openai    → OpenAIVisionProvider
        │                 GPT-4o with JSON response format, detail=low
        │                 → on any failure: SimulationVisionProvider fallback
        │
        ├── gemini    → GeminiVisionProvider (placeholder → simulation)
        │
        └── local     → LocalVisionProvider  (placeholder → simulation)
```

---

## Structured Output (VisionAnalysisV4)

All providers return `VisionAnalysisV4` (defined in `src/types/vision.ts`):

```typescript
{
  environment: string;          // "Moving near traffic"
  objects: Detection[];         // backward-compatible legacy field
  hazards: VisionHazardResult[]; // type, severity, confidence, description
  confidence: number;           // 0–1 overall scene confidence
  recommendedAction: string;    // what the user should do now
  reasoning: string;            // brief AI reasoning summary
  provider: string;             // which provider produced this
  isRealAI: boolean;            // true = real model; false = simulation
  usedFallback: boolean;        // true = real provider failed, using simulation
}
```

The `/api/vision/analyze-frame` route response additionally includes:

- `detections` — same as `visionAnalysis.objects` (backward-compatible for `useVisionSession`)
- `isRealAI`, `usedFallback`, `provider` — promoted to top level for UI display

---

## OpenAI Integration

**Model:** `gpt-4o` with `detail: "low"` (fast, cost-efficient)
**Format:** JSON mode (`response_format: { type: "json_object" }`)
**Temperature:** 0.1 (deterministic, safety-focused)

The system prompt enforces:
- No face recognition or personal identification
- Hedged language — never says "safe" with certainty
- Confidence < 0.7 → uncertainty note appended to `recommendedAction`
- Severity only: `critical | high | medium | low`
- Navigation-focused labels only

---

## Fallback Behavior

If a real provider fails (network error, API error, quota exceeded, malformed
JSON), it silently falls back to `SimulationVisionProvider` and sets:

- `usedFallback: true` in the response
- `provider` includes `/error-fallback` suffix for debugging

The session continues uninterrupted. The user is never left without guidance.

---

## Privacy

Camera frames sent to OpenAI:
- Sent as JPEG base64 in a single API call
- Not stored by Denarixx — no database write, no disk write
- OpenAI data handling applies (see openai.com/privacy)
- Face recognition is explicitly disabled in the system prompt
- Emergency streaming is not supported

**Privacy notice** is displayed on the Vision Session page before the session
begins. Users must grant camera permission through the standard browser dialog.

---

## Safety Constraints

These are hardcoded and cannot be changed via environment variables:

| Constraint                | Status   |
|---------------------------|----------|
| Face recognition          | Disabled |
| Emergency streaming       | Disabled |
| Certainty about safety    | Never expressed |
| Uncertainty threshold     | confidence < 0.7 → "I'm not completely sure — please check carefully." |

---

## Engine Integration

The `objects` (Detection[]) from `VisionAnalysisV4` feed directly into the
existing engine pipeline — no engine changes required:

```
VisionAnalysisV4.objects (Detection[])
    │
    ├── /api/hazards/evaluate → HazardDetectionEngine
    │        │
    │        └── /api/safety/decide → SafetyDecisionEngine
    │
    ├── Cognitive Guardian pipeline (V2)
    │        cognitiveGuardianEngine → proactiveAlertEngine → silenceDecisionEngine
    │
    └── Cognitive Reasoning pipeline (V3)
             environmentUnderstandingEngine → cognitiveReasoningEngine → actionDecisionEngine
```

---

## Enabling OpenAI in Replit

1. Go to **Secrets** (lock icon in left panel)
2. Add `VISION_PROVIDER` = `openai`
3. Add `OPENAI_API_KEY` = your key from platform.openai.com
4. Restart the **Start application** workflow

To revert: change `VISION_PROVIDER` back to `simulation`.

---

## File Map

| File | Role |
|------|------|
| `src/types/vision.ts` | `VisionAnalysisV4` and `VisionAnalysisProvider` types |
| `src/engines/visionProviderFactory.ts` | Factory + singleton, reads `VISION_PROVIDER` env |
| `src/engines/providers/SimulationVisionProvider.ts` | Default provider, wraps MockVisionProvider |
| `src/engines/providers/OpenAIVisionProvider.ts` | GPT-4o with fallback |
| `src/engines/providers/GeminiVisionProvider.ts` | Placeholder (Phase 5) |
| `src/engines/providers/LocalVisionProvider.ts` | Placeholder (Phase 5) |
| `src/app/api/vision/analyze-frame/route.ts` | Entry point — calls factory, returns V4 + legacy fields |
