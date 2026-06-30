import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getSafetyEngine } from '@/engines/SafetyDecisionEngine';
import type { HazardAlert } from '@/types';

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
  alerts: z.array(alertSchema),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const alerts = body.alerts.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    })) as HazardAlert[];

    const decision = getSafetyEngine().decide(alerts);
    return ok({ sessionId: body.sessionId, decision });
  } catch (e) {
    return handleError(e);
  }
}
