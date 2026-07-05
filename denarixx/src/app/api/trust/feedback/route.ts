import { ok, handleError } from '@/lib/api';
import { getTrustStore, recordFeedback } from '@/lib/trustStore';
import { getFeedbackSummary, getAllFeedback } from '@/engines/decisionTraceEngine';
import type { FeedbackType } from '@/types/trust';

const VALID_TYPES: FeedbackType[] = ['useful', 'too_much', 'too_late', 'wrong', 'unclear'];

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      decisionId?: string;
      type?: string;
      note?: string;
    };
    const { decisionId, type, note = null } = body;

    if (!decisionId || typeof decisionId !== 'string') {
      return Response.json({ ok: false, error: 'decisionId is required' }, { status: 400 });
    }
    if (!type || !VALID_TYPES.includes(type as FeedbackType)) {
      return Response.json(
        { ok: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const saved = recordFeedback(decisionId, type as FeedbackType, note ?? null);
    if (!saved) {
      return Response.json({ ok: false, error: 'Decision not found' }, { status: 404 });
    }

    return ok({ saved: true, decisionId, type });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET() {
  try {
    const store = getTrustStore();
    const summary = getFeedbackSummary(store);
    const all = getAllFeedback(store);
    return ok({ summary, feedback: all });
  } catch (e) {
    return handleError(e);
  }
}
