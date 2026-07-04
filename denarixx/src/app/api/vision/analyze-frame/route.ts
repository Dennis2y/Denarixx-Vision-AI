import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getVisionEngine } from '@/engines/VisionEngine';
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

    const engine = getVisionEngine();
    const detections = await engine.analyzeFrame(frame);
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
      detections,
      provider: engine.getProvider().name,
      latencyMs,
      timestamp: frame.timestamp,
    });
  } catch (e) {
    return handleError(e);
  }
}
