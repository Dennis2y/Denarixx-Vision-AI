import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getHazardEngine } from '@/engines/HazardDetectionEngine';

const detectionSchema = z.object({
  label: z.string(),
  confidence: z.number().min(0).max(1),
  boundingBox: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
});

const schema = z.object({
  sessionId: z.string().min(1),
  detections: z.array(detectionSchema),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const alerts = await getHazardEngine().evaluate(body.detections);
    return ok({
      sessionId: body.sessionId,
      alerts,
      count: alerts.length,
      hasHighPriority: alerts.some((a) =>
        ['critical', 'high'].includes(a.severity)
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}
