---
name: V3 Cognitive Reasoning Pipeline
description: Architecture and key decisions for the V3 reasoning engines and page.
---

## The pipeline (in order)
1. EnvironmentUnderstandingEngine — maps detections → environment type + natural summary
2. RiskPredictionEngine — maps detections → specific predicted event + risk level + time-to-impact
3. CognitiveReasoningEngine — answers 8 internal questions (safe? interrupt? reassure? etc.)
4. ActionDecisionEngine — priority-ordered rules → recommended action + instruction
5. HumanGuideEngine — natural language output; low-confidence (<70%) adds uncertainty note

## Key design decisions

**Why no API routes for V3?**  
All 5 engines are pure TypeScript computation with no I/O. Importing them directly on the 'use client' page gives <1ms per frame latency and keeps deployment simple. API routes only needed when there's server-side state.

**Why V3RiskPrediction, not RiskPrediction?**  
V2 (cognitive.ts) already exports `RiskPrediction`. V3 uses `V3RiskPrediction` in reasoning.ts to avoid name collision.

**Why ReasoningRiskLevel, not RiskLevel?**  
V2 (cognitive.ts) exports `RiskLevel = 'none'|'low'|'medium'|'high'|'critical'`. V3 adds `'informational'`. Using `ReasoningRiskLevel` avoids augmenting the shared type.

**HumanGuideEngine reset()**  
The reassurance rotation uses an instance property (not module-level state). Call reset() between sessions to restart rotation.

## Tests
- v3reasoning.test.ts — 27 tests across all 5 engines
- No external dependencies — runs with `npx tsx tests/v3reasoning.test.ts`
