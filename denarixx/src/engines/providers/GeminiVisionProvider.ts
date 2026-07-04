/**
 * GeminiVisionProvider (V4 — Sprint 4)
 *
 * Uses Google Gemini 1.5 Flash vision to analyze camera frames and return
 * structured VisionAnalysisV4 output. Requires GEMINI_API_KEY in the server
 * environment.
 *
 * To activate: set VISION_PROVIDER=gemini and GEMINI_API_KEY.
 *
 * Safety constraints (same as OpenAIVisionProvider):
 *   - Face recognition explicitly disabled in system prompt
 *   - Hedged language enforced — never expresses certainty
 *   - Confidence < 0.7 → uncertainty note appended to recommendedAction
 *
 * Falls back to SimulationVisionProvider on any API error (network, quota,
 * malformed response) with usedFallback=true.
 *
 * Sprint 4: categories field populated via categorizeDetections().
 */

import type { VisionAnalysisProvider, VisionAnalysisV4, VisionHazardResult } from '@/types/vision';
import type { VisionFrame, Detection, HazardSeverity } from '@/types';
import { SimulationVisionProvider } from './SimulationVisionProvider';
import { categorizeDetections } from './categorizeDetections';

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const VISION_SYSTEM_INSTRUCTION = `You are a safety-focused AI assistant for blind and visually impaired users.
Analyze the camera frame and return ONLY a valid JSON object in this exact format:

{
  "environment": "brief natural-language description of the overall scene",
  "objects": [
    { "label": "vehicle", "confidence": 0.92 },
    { "label": "road", "confidence": 0.97 }
  ],
  "hazards": [
    {
      "type": "vehicle",
      "severity": "critical",
      "confidence": 0.92,
      "description": "Vehicle approaching — stop and wait for it to pass."
    }
  ],
  "confidence": 0.88,
  "recommendedAction": "Stop immediately — vehicle approaching.",
  "reasoning": "A vehicle is clearly visible approaching the user's position."
}

Rules you MUST follow:
- NEVER identify individual people by face, name, or appearance — face recognition is disabled
- NEVER say the environment is completely safe — always use hedged language
- If overall confidence is below 0.7, add "I'm not completely sure — please check carefully." to recommendedAction
- Severity levels MUST be exactly one of: critical, high, medium, low
  - critical: life-threatening (approaching vehicle, fast cyclist at road crossing)
  - high: serious risk (stairs, step down, large obstacle in path)
  - medium: caution needed (person nearby, slow cyclist, small obstacle)
  - low: awareness only (background elements, distant objects)
- Object labels must be navigation-relevant — use ONLY these values:
  vehicle, bicycle, cyclist, motorcycle, bus, truck, person, pedestrian,
  obstacle, step, stairs, escalator, road, crossing, intersection, pavement,
  door, gate, entrance, exit, sign, traffic_light, signal
- Focus ONLY on navigation hazards — ignore colours, brands, logos, text content
- Return ONLY the JSON object — no explanatory text before or after`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

interface ParsedGeminiAnalysis {
  environment?: string;
  objects?: Array<{ label?: string; confidence?: number }>;
  hazards?: Array<{
    type?: string;
    severity?: string;
    confidence?: number;
    description?: string;
  }>;
  confidence?: number;
  recommendedAction?: string;
  reasoning?: string;
}

const VALID_SEVERITIES = new Set<HazardSeverity>(['critical', 'high', 'medium', 'low']);

function sanitizeSeverity(s: string | undefined): HazardSeverity {
  if (s && VALID_SEVERITIES.has(s as HazardSeverity)) return s as HazardSeverity;
  return 'medium';
}

function clampConf(n: number | undefined): number {
  return Math.min(1, Math.max(0, n ?? 0.5));
}

export class GeminiVisionProvider implements VisionAnalysisProvider {
  readonly providerName = 'GeminiVisionProvider';
  readonly isRealAI = true;
  private fallback = new SimulationVisionProvider();

  constructor(private readonly apiKey: string) {}

  async analyzeFrameV4(
    frame: VisionFrame,
    imageData: string | null
  ): Promise<VisionAnalysisV4> {
    // No camera frame — fall back silently to simulation
    if (!imageData) {
      const result = await this.fallback.analyzeFrameV4(frame, null);
      return { ...result, usedFallback: true, provider: `${this.providerName}/no-frame` };
    }

    try {
      const url = `${GEMINI_ENDPOINT}?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: VISION_SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: 'Analyze this camera frame for navigation assistance. Return the JSON analysis only.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 900,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const geminiResponse = (await response.json()) as GeminiResponse;

      if (geminiResponse.error?.message) {
        throw new Error(`Gemini API error: ${geminiResponse.error.message}`);
      }

      const rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini API');

      // Gemini with responseMimeType=application/json may still wrap in markdown
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as ParsedGeminiAnalysis;

      // Map objects → Detection[]
      const objects: Detection[] = (parsed.objects ?? [])
        .filter((o): o is { label: string; confidence?: number } => typeof o.label === 'string' && o.label.length > 0)
        .map((o) => ({
          label: o.label.toLowerCase().trim(),
          confidence: clampConf(o.confidence),
        }));

      // Map hazards with sanitization
      const hazards: VisionHazardResult[] = (parsed.hazards ?? [])
        .filter((h): h is typeof h & { type: string } => typeof h.type === 'string')
        .map((h) => ({
          type: h.type.toLowerCase().trim(),
          severity: sanitizeSeverity(h.severity),
          confidence: clampConf(h.confidence),
          description: h.description ?? `${h.type} detected`,
        }));

      const overallConf = clampConf(parsed.confidence);
      let recommendedAction = parsed.recommendedAction ?? 'Continue with caution.';
      if (overallConf < 0.7 && !recommendedAction.includes('sure')) {
        recommendedAction += " I'm not completely sure — please check carefully.";
      }

      return {
        environment: parsed.environment ?? 'Scanning environment…',
        objects,
        categories: categorizeDetections(objects),
        hazards,
        confidence: overallConf,
        recommendedAction,
        reasoning: parsed.reasoning ?? 'Gemini analysis complete.',
        provider: this.providerName,
        isRealAI: true,
        usedFallback: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[GeminiVisionProvider] Analysis failed — falling back to simulation. Reason: ${message}`
      );
      const result = await this.fallback.analyzeFrameV4(frame, null);
      return {
        ...result,
        usedFallback: true,
        provider: `${this.providerName}/error-fallback`,
      };
    }
  }
}
