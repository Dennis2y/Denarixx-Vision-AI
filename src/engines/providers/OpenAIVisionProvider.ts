/**
 * OpenAI Vision Provider — plug-in slot for Phase 2.
 * Requires OPENAI_API_KEY environment variable.
 * NOT used in Phase 1 MVP simulation mode.
 */
import type { VisionProvider, ProviderCapabilities } from '../types';
import type { VisionFrame, Detection } from '@/types';

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = 'OpenAIVisionProvider';
  readonly capabilities: ProviderCapabilities = {
    hazardDetection: true,
    sceneDescription: true,
    objectRecognition: true,
    faceRecognition: false, // disabled Phase 1
    confidence: true,
  };

  async analyzeFrame(frame: VisionFrame): Promise<Detection[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    if (!frame.imageData) return [];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are an assistive AI for blind users. List the objects and potential hazards you detect in this image as a JSON array of {label, confidence} objects. Confidence is 0-1. Focus on safety-critical items. Respond only with valid JSON.',
              },
              {
                type: 'image_url',
                image_url: { url: frame.imageData },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '[]';

    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
