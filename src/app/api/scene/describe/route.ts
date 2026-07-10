import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getSceneEngine } from '@/engines/SceneReasoningEngine';
import type { VisionFrame } from '@/types';

const schema = z.object({
  sessionId: z.string().min(1),
  imageData: z.string().optional(),
  source: z.enum(['camera', 'simulation', 'upload']).default('simulation'),
  detections: z.array(
    z.object({
      label: z.string(),
      confidence: z.number(),
      boundingBox: z
        .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
        .optional(),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const frame: VisionFrame = {
      imageData: body.imageData,
      timestamp: new Date(),
      source: body.source,
    };
    const scene = await getSceneEngine().describe(frame, body.detections);
    return ok({ sessionId: body.sessionId, scene });
  } catch (e) {
    return handleError(e);
  }
}
