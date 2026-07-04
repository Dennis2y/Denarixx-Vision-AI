import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getVisionAnalysisProvider } from '@/engines/visionProviderFactory';
import { getSession, updateSession } from '@/lib/sessionStore';
import type { VisionFrame } from '@/types';

const schema = z.object({
  sessionId: z.string().min(1),
  imageData: z.string().optional(),
  source: z.enum(['camera', 'simulation', 'upload']).default('simulation'),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const start = Date.now();

    const frame: VisionFrame = {
      imageData: body.imageData,
      timestamp: new Date(),
      source: body.source,
    };

    const provider = getVisionAnalysisProvider();
    const analysis = await provider.analyzeFrameV4(frame, body.imageData ?? null);
    const latencyMs = Date.now() - start;

    const session = getSession(body.sessionId);
    if (session) {
      updateSession(body.sessionId, {
        frameCount: session.frameCount + 1,
        latencyMs: [...session.latencyMs, latencyMs],
      });
    }

    return ok({
      sessionId: body.sessionId,
      // Legacy field — kept for backward compatibility with useVisionSession and downstream engines
      detections: analysis.objects,
      // V4 rich analysis — environment, hazards, recommendedAction, reasoning, etc.
      visionAnalysis: analysis,
      provider: analysis.provider,
      isRealAI: analysis.isRealAI,
      usedFallback: analysis.usedFallback,
      latencyMs,
      timestamp: frame.timestamp,
      mode: body.imageData ? 'camera' : 'simulation',
      frameReceived: !!body.imageData,
    });
  } catch (e) {
    return handleError(e);
  }
}
