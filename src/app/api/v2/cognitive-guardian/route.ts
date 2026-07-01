import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getCognitiveGuardian, CognitiveGuardianEngine } from '@/engines/cognitiveGuardianEngine';
import { getHazardEngine } from '@/engines/HazardDetectionEngine';
import { getSceneEngine } from '@/engines/SceneReasoningEngine';
import type { VisionFrame } from '@/types';

const detectionSchema = z.object({
  label: z.string(),
  confidence: z.number().min(0).max(1),
});

const alertSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number(),
  timestamp: z.string().or(z.date()),
  shouldInterrupt: z.boolean(),
  disclaimer: z.string(),
});

const schema = z.object({
  sessionId: z.string().min(1),
  detections: z.array(detectionSchema),
  alerts: z.array(alertSchema).optional(),
  sceneLabel: z.string().optional(),
  imageData: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    const frame: VisionFrame = {
      imageData: body.imageData,
      timestamp: new Date(),
      source: 'simulation',
    };

    // Build scene from detections
    const scene = await getSceneEngine().describe(frame, body.detections);

    // Use provided alerts or evaluate fresh
    let alerts = (body.alerts ?? []).map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }));

    if (alerts.length === 0 && body.detections.length > 0) {
      alerts = await getHazardEngine().evaluate(body.detections);
    }

    // Infer user state from scene + alerts
    const userState = CognitiveGuardianEngine.inferUserState(scene, alerts);

    // Run cognitive guardian
    const guardian = getCognitiveGuardian();
    const decision = await guardian.evaluate(scene, alerts, userState);

    return ok({
      sessionId: body.sessionId,
      decision,
      scene,
      alertCount: alerts.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
