/**
 * OpenAIVisionProvider (V4)
 *
 * Uses GPT-4o vision to analyze camera frames and return structured
 * VisionAnalysisV4 output. Requires OPENAI_API_KEY in the server environment.
 *
 * Safety constraints (enforced via system prompt):
 *   - Face recognition is explicitly disabled
 *   - Emergency streaming is not supported
 *   - Certainty is never expressed — uncertainty notes added below 0.7
 *
 * If the API call fails for any reason (network, quota, malformed response),
 * the provider falls back to SimulationVisionProvider and sets usedFallback=true.
 *
 * Sprint 4: categories field populated via categorizeDetections().
 */

import type { VisionAnalysisProvider, VisionAnalysisV4, VisionHazardResult } from '@/types/vision';
import type { VisionFrame, Detection, HazardSeverity } from '@/types';
import { SimulationVisionProvider } from './SimulationVisionProvider';
import { categorizeDetections } from './categorizeDetections';

const VISION_SYSTEM_PROMPT = `You are a safety-focused AI assistant for blind and visually impaired users.
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

interface GPTVisionResponse {
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

export class OpenAIVisionProvider implements VisionAnalysisProvider {
  readonly providerName = 'OpenAIVisionProvider';
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 900,
          temperature: 0.1,
          messages: [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageData}`,
                    detail: 'low',
                  },
                },
                {
                  type: 'text',
                  text: 'Analyze this camera frame for navigation assistance. Return the JSON analysis.',
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenAI API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = json.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error('Empty response content from OpenAI');

      const parsed = JSON.parse(rawContent) as GPTVisionResponse;

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
        reasoning: parsed.reasoning ?? 'AI analysis complete.',
        provider: this.providerName,
        isRealAI: true,
        usedFallback: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[OpenAIVisionProvider] Analysis failed — falling back to simulation. Reason: ${message}`
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
