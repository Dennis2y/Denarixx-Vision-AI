import { ok, handleError } from '@/lib/api';
import { getTrustStore } from '@/lib/trustStore';
import {
  getLatestTrace,
  getTraceCount,
  getSilenceRatio,
  getAverageConfidence,
  getFeedbackSummary,
  filterTracesBySource,
  filterSpokenTraces,
  filterSilentTraces,
} from '@/engines/decisionTraceEngine';
import { TRUST_DISCLAIMER } from '@/types/trust';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');

    const store = getTrustStore();
    const latest = getLatestTrace(store);

    const traces = source
      ? filterTracesBySource(store, source)
      : store.traces;

    const spoken = filterSpokenTraces(store).length;
    const silent = filterSilentTraces(store).length;

    return ok({
      latest: latest ?? null,
      stats: {
        total: getTraceCount(store),
        spoken,
        silent,
        silenceRatio: getSilenceRatio(store),
        averageConfidence: getAverageConfidence(store),
      },
      feedback: getFeedbackSummary(store),
      traces: traces.slice(-20),
      disclaimer: TRUST_DISCLAIMER,
    });
  } catch (e) {
    return handleError(e);
  }
}
