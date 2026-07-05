import { ok, handleError } from '@/lib/api';
import { getTrustStore, recordDecision } from '@/lib/trustStore';
import { getRecentTraces } from '@/engines/decisionTraceEngine';
import { buildSilentExplanation } from '@/engines/explainableAIEngine';
import { TRUST_DISCLAIMER } from '@/types/trust';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const n = Math.min(50, Math.max(1, Number(searchParams.get('n') ?? '10')));
    const store = getTrustStore();
    const traces = getRecentTraces(store, n);
    return ok({
      traces: traces.map(t => ({
        decision: t.decision,
        feedback: t.feedback,
      })),
      total: store.traces.length,
      disclaimer: TRUST_DISCLAIMER,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reason, detections = [], fatigueLevel = 'low' } = body as {
      reason?: string;
      detections?: { label: string; confidence: number }[];
      fatigueLevel?: string;
    };
    const decision = buildSilentExplanation({
      reason: reason ?? 'No hazard detected',
      detections,
      fatigueLevel,
    });
    recordDecision(decision);
    return ok({ decision, disclaimer: TRUST_DISCLAIMER });
  } catch (e) {
    return handleError(e);
  }
}
