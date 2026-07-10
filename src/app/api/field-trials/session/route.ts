import { NextRequest, NextResponse } from 'next/server';
import {
  createTrialSession,
  startTrialSession,
  endTrialSession,
  triggerEmergencyStop,
  recordTrialAlert,
  recordSilenceDecision,
  addIncidentReport,
  addSupervisorNote,
  deleteSessionData,
  validateConsent,
} from '@/engines/fieldTrialEngine';
import type { TrialConsent, TrialScenario } from '@/types/fieldTrial';
import { trialSessionStore } from '@/lib/fieldTrialStore';

// POST — create session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { consent, scenario } = body as { consent: TrialConsent; scenario: TrialScenario };
    if (!consent || !scenario) {
      return NextResponse.json({ error: 'consent and scenario required' }, { status: 400 });
    }
    const validation = validateConsent(consent);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Consent invalid', violations: validation.violations }, { status: 422 });
    }
    const session = createTrialSession(consent, scenario);
    trialSessionStore.set(session.sessionId, session);
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// GET — retrieve session
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const session = trialSessionStore.get(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.phase === 'deleted') return NextResponse.json({ error: 'Session deleted' }, { status: 410 });
  return NextResponse.json({ session });
}

// PATCH — update session (start, end, emergency stop, record alert, silence, incident, note)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, action, payload } = body as { sessionId: string; action: string; payload?: unknown };
    let session = trialSessionStore.get(sessionId);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.phase === 'deleted') return NextResponse.json({ error: 'Session deleted' }, { status: 410 });

    switch (action) {
      case 'start': session = startTrialSession(session); break;
      case 'end': session = endTrialSession(session); break;
      case 'emergency_stop': session = triggerEmergencyStop(session); break;
      case 'record_alert':
        session = recordTrialAlert(session, payload as Parameters<typeof recordTrialAlert>[1]); break;
      case 'record_silence':
        session = recordSilenceDecision(session, payload as Parameters<typeof recordSilenceDecision>[1]); break;
      case 'add_incident':
        session = addIncidentReport(session, payload as Parameters<typeof addIncidentReport>[1]); break;
      case 'add_note':
        session = addSupervisorNote(session, payload as Parameters<typeof addSupervisorNote>[1]); break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    trialSessionStore.set(sessionId, session);
    return NextResponse.json({ session });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// DELETE — redact session data
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const session = trialSessionStore.get(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const redacted = deleteSessionData(session);
  trialSessionStore.set(id, redacted);
  return NextResponse.json({ deleted: true, sessionId: id });
}
