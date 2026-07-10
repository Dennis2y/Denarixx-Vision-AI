import { NextRequest, NextResponse } from 'next/server';
import { calculateSafetyMetrics } from '@/engines/safetyValidationEngine';
import { calculateFeedbackSummary } from '@/engines/userFeedbackEngine';
import {
  generateTrialReport,
  exportReportAsJSON,
  deleteReport,
} from '@/engines/trialReportEngine';
import { trialSessionStore, trialReportStore } from '@/lib/fieldTrialStore';

// POST — generate report for session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body as { sessionId: string };
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const session = trialSessionStore.get(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.phase === 'deleted') return NextResponse.json({ error: 'Session deleted' }, { status: 410 });
    if (session.phase === 'active') return NextResponse.json({ error: 'Session still active — end it first' }, { status: 422 });

    const metrics = calculateSafetyMetrics(session);
    const summary = calculateFeedbackSummary(session.alertFeedbacks);
    const report = generateTrialReport(session, metrics, summary);
    trialReportStore.set(report.reportId, report);
    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// GET — retrieve report or export as JSON
export async function GET(req: NextRequest) {
  const reportId = req.nextUrl.searchParams.get('id');
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const exportJson = req.nextUrl.searchParams.get('export') === 'json';

  const id = reportId ?? (sessionId ? `report-${sessionId}` : null);
  if (!id) return NextResponse.json({ error: 'id or sessionId required' }, { status: 400 });

  const report = trialReportStore.get(id);
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (report.deleted) return NextResponse.json({ error: 'Report deleted' }, { status: 410 });

  if (exportJson) {
    return new Response(exportReportAsJSON(report), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="trial-report-${id}.json"` },
    });
  }

  return NextResponse.json({ report });
}

// DELETE — delete report
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const report = trialReportStore.get(id);
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const deleted = deleteReport(report);
  trialReportStore.set(id, deleted);
  return NextResponse.json({ deleted: true, reportId: id });
}
