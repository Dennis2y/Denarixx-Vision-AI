import { NextRequest, NextResponse } from 'next/server';
import { addAlertFeedback } from '@/engines/fieldTrialEngine';
import { createAlertFeedback, validateFeedbackResponses } from '@/engines/userFeedbackEngine';
import { trialSessionStore } from '@/lib/fieldTrialStore';

// POST — record alert feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, alertId, responses } = body;
    if (!sessionId || !alertId || !responses) {
      return NextResponse.json({ error: 'sessionId, alertId, and responses required' }, { status: 400 });
    }

    const session = trialSessionStore.get(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.phase === 'deleted') return NextResponse.json({ error: 'Session deleted' }, { status: 410 });

    const feedback = createAlertFeedback(alertId, sessionId, responses);
    if (!validateFeedbackResponses(feedback)) {
      return NextResponse.json({ error: 'Invalid feedback responses' }, { status: 422 });
    }

    const updated = addAlertFeedback(session, feedback);
    trialSessionStore.set(sessionId, updated);
    return NextResponse.json({ feedback, feedbackCount: updated.alertFeedbacks.length }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// GET — list feedbacks for session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const session = trialSessionStore.get(sessionId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.phase === 'deleted') return NextResponse.json({ error: 'Deleted' }, { status: 410 });
  return NextResponse.json({ feedbacks: session.alertFeedbacks, count: session.alertFeedbacks.length });
}
