'use client';

import { useState } from 'react';
import {
  createTrialSession,
  startTrialSession,
  endTrialSession,
  triggerEmergencyStop,
  recordTrialAlert,
  addAlertFeedback,
  addIncidentReport,
  addSupervisorNote,
  deleteSessionData,
  validateConsent,
  getScenarioList,
  formatDuration,
  getSessionDurationMs,
} from '@/engines/fieldTrialEngine';
import { calculateSafetyMetrics, formatMetricsGrade } from '@/engines/safetyValidationEngine';
import { calculateFeedbackSummary, createAlertFeedback } from '@/engines/userFeedbackEngine';
import { generateTrialReport, exportReportAsJSON, deleteReport } from '@/engines/trialReportEngine';
import type {
  TrialSession,
  TrialReport,
  TrialScenario,
  TrialConsent,
  AlertFeedback,
} from '@/types/fieldTrial';

type Phase = 'consent' | 'setup' | 'active' | 'report';

const SCENARIOS = getScenarioList();

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    green: 'bg-green-900/50 text-green-300 border-green-700',
    yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    red: 'bg-red-900/50 text-red-300 border-red-700',
    gray: 'bg-gray-700 text-gray-300 border-gray-600',
    blue: 'bg-blue-900/50 text-blue-300 border-blue-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls[color] ?? cls.gray}`}>{children}</span>;
}

export default function FieldTrialsPage() {
  const [phase, setPhase] = useState<Phase>('consent');
  const [session, setSession] = useState<TrialSession | null>(null);
  const [report, setReport] = useState<TrialReport | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [consent, setConsent] = useState({
    consentGiven: false,
    supervisorPresent: false,
    assistiveSupportOnly: false,
    noVideoStorageConfirmed: false,
    noFaceRecognitionConfirmed: false,
  });
  const [selectedScenario, setSelectedScenario] = useState<TrialScenario | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<AlertFeedback | null>(null);

  const consentObj: TrialConsent = {
    participantId,
    consentTimestamp: Date.now(),
    ...consent,
  };

  const { valid: consentValid, violations } = validateConsent(consentObj);

  // ── Phase: Consent ────────────────────────────────────────────────────────
  if (phase === 'consent') {
    return (
      <div className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-yellow-400 mb-1">🧪 Field Trial — Consent</h1>
        <p className="text-gray-400 text-sm mb-6">V17 Real-World Safety Validation · Germany Pilot</p>

        <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-sm text-red-300 space-y-1">
          <p className="font-bold">⚠ Important Disclaimers</p>
          <p>• This is an AI assistive tool — it does not guarantee safety.</p>
          <p>• A human supervisor must be present at all times.</p>
          <p>• No video is stored. No face recognition is performed.</p>
          <p>• You can stop at any time with the Emergency Stop button.</p>
          <p>• Location data is not stored by default.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Anonymized Participant ID *</label>
            <input
              value={participantId}
              onChange={e => setParticipantId(e.target.value)}
              placeholder="e.g. P001 (no real names)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          {[
            { key: 'consentGiven', label: 'I consent to participate in this field trial session.' },
            { key: 'supervisorPresent', label: 'A human supervisor is physically present for this session.' },
            { key: 'assistiveSupportOnly', label: 'I understand this AI provides assistive support only — not certainty.' },
            { key: 'noVideoStorageConfirmed', label: 'I confirm no video footage will be stored.' },
            { key: 'noFaceRecognitionConfirmed', label: 'I confirm no face recognition is used.' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consent[key as keyof typeof consent]}
                onChange={e => setConsent(c => ({ ...c, [key]: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-yellow-400"
              />
              <span className="text-sm text-gray-300 group-hover:text-white">{label}</span>
            </label>
          ))}
        </div>

        {violations.length > 0 && (
          <ul className="mt-4 text-xs text-red-400 space-y-0.5">
            {violations.map((v, i) => <li key={i}>• {v}</li>)}
          </ul>
        )}

        <button
          onClick={() => setPhase('setup')}
          disabled={!consentValid}
          className={`mt-6 w-full py-3 rounded-xl font-bold text-sm transition-colors ${
            consentValid ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Proceed to Scenario Selection →
        </button>
      </div>
    );
  }

  // ── Phase: Setup ──────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-yellow-400 mb-1">🗺 Select Trial Scenario</h1>
        <p className="text-gray-400 text-sm mb-6">Choose the environment you will test in today.</p>

        <div className="space-y-3">
          {SCENARIOS.map(sc => (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                selectedScenario === sc.id
                  ? 'border-yellow-400 bg-yellow-400/10'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-white">{sc.name}</span>
                <div className="flex gap-1.5">
                  <Badge color={sc.riskLevel === 'low' ? 'green' : sc.riskLevel === 'medium' ? 'yellow' : 'red'}>
                    {sc.riskLevel} risk
                  </Badge>
                  <Badge>{sc.indoorOutdoor}</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-400">{sc.description}</p>
              <p className="text-xs text-yellow-700 mt-1">⚠ {sc.safetyNotes}</p>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (!selectedScenario) return;
            const s = createTrialSession(consentObj, selectedScenario);
            const started = startTrialSession(s);
            setSession(started);
            setPhase('active');
          }}
          disabled={!selectedScenario}
          className={`mt-6 w-full py-3 rounded-xl font-bold text-sm transition-colors ${
            selectedScenario ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Start Field Trial Session →
        </button>
      </div>
    );
  }

  // ── Phase: Active ─────────────────────────────────────────────────────────
  if (phase === 'active' && session) {
    const durationMs = getSessionDurationMs(session);
    const scenarioInfo = SCENARIOS.find(s => s.id === session.scenario);

    const handleSimulateAlert = () => {
      const severities = ['critical', 'high', 'medium', 'low'] as const;
      const sev = severities[session.alerts.length % 4];
      const updated = recordTrialAlert(session, {
        timestamp: Date.now(),
        alertType: 'obstacle_detected',
        severity: sev,
        message: `${sev.charAt(0).toUpperCase() + sev.slice(1)} hazard detected ahead`,
        wasSpoken: true,
        wasHaptic: sev === 'critical' || sev === 'high',
        responseTimeMs: Math.round(800 + Math.random() * 1200),
      });
      setSession(updated);
    };

    const handleFeedbackOnLast = () => {
      if (!session.alerts.length) return;
      const lastAlert = session.alerts[session.alerts.length - 1];
      const fb = createAlertFeedback(lastAlert.alertId, session.sessionId, {
        usefulness: 'useful',
        timing: 'just_right',
        frequency: 'about_right',
        clarity: 'clear',
        userFeltOverwhelmed: false,
        userFeltSafer: true,
        suggestedAlternativeText: '',
        supervisorObservedMissedHazard: false,
      });
      const updated = addAlertFeedback(session, fb);
      setSession(updated);
      setLastFeedback(fb);
    };

    const handleAddNote = () => {
      if (!noteContent.trim()) return;
      const updated = addSupervisorNote(session, {
        timestamp: Date.now(),
        content: noteContent,
        category: 'general',
      });
      setSession(updated);
      setNoteContent('');
    };

    const handleAddIncident = () => {
      if (!incidentDesc.trim()) return;
      const updated = addIncidentReport(session, {
        timestamp: Date.now(),
        description: incidentDesc,
        severity: 'minor',
        supervisorAction: 'Noted',
        resolved: false,
      });
      setSession(updated);
      setIncidentDesc('');
    };

    const handleEnd = () => {
      const ended = endTrialSession(session);
      const metrics = calculateSafetyMetrics(ended);
      const summary = calculateFeedbackSummary(ended.alertFeedbacks);
      const r = generateTrialReport(ended, metrics, summary);
      setSession(ended);
      setReport(r);
      setPhase('report');
    };

    const handleEmergencyStop = () => {
      const stopped = triggerEmergencyStop(session);
      const metrics = calculateSafetyMetrics(stopped);
      const summary = calculateFeedbackSummary(stopped.alertFeedbacks);
      const r = generateTrialReport(stopped, metrics, summary);
      setSession(stopped);
      setReport(r);
      setPhase('report');
    };

    return (
      <div className="min-h-screen bg-gray-950 text-white px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-yellow-400">🧪 Trial Active</h1>
            <p className="text-xs text-gray-500">{scenarioInfo?.name} · {participantId}</p>
          </div>
          <div className="text-xs text-gray-400">{formatDuration(durationMs)}</div>
        </div>

        {/* Emergency Stop */}
        <button
          onClick={handleEmergencyStop}
          className="w-full py-4 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black text-lg tracking-wide"
          style={{ minHeight: 72 }}
        >
          ⛔ EMERGENCY STOP
        </button>

        {/* Alert simulation controls */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Alerts ({session.alerts.length})</span>
            <Badge color={session.alerts.length === 0 ? 'gray' : 'yellow'}>{session.alerts.length} triggered</Badge>
          </div>

          {session.alerts.slice(-3).map(a => (
            <div key={a.alertId} className="text-xs bg-gray-800 rounded-lg p-2">
              <span className={`font-semibold ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'}`}>
                {a.severity.toUpperCase()}
              </span>
              <span className="text-gray-300 ml-2">{a.message}</span>
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={handleSimulateAlert} className="flex-1 py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-xs font-bold text-white">
              + Simulate Alert
            </button>
            <button
              onClick={handleFeedbackOnLast}
              disabled={session.alerts.length === 0}
              className="flex-1 py-2 bg-blue-800 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xs font-bold text-white"
            >
              ✓ Mark Last Useful
            </button>
          </div>
          {lastFeedback && <p className="text-xs text-green-400">✓ Feedback recorded for last alert</p>}
        </div>

        {/* Supervisor Notes */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-400">Supervisor Notes ({session.supervisorNotes.length})</p>
          <div className="flex gap-2">
            <input
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Add supervisor observation..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button onClick={handleAddNote} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white font-bold">Add</button>
          </div>
        </div>

        {/* Incident Report */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-400">Incident Reports ({session.incidentReports.length})</p>
          <div className="flex gap-2">
            <input
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
              placeholder="Describe incident (minor/moderate/serious)..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button onClick={handleAddIncident} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded-lg text-xs text-white font-bold">Log</button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Alerts', val: session.alerts.length },
            { label: 'Feedback', val: session.alertFeedbacks.length },
            { label: 'Notes', val: session.supervisorNotes.length },
            { label: 'Incidents', val: session.incidentReports.length },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-2">
              <p className="text-lg font-bold text-white">{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <button onClick={handleEnd} className="w-full py-3 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold text-sm">
          ✓ End Session & Generate Report
        </button>
      </div>
    );
  }

  // ── Phase: Report ─────────────────────────────────────────────────────────
  if (phase === 'report' && report) {
    const m = report.safetyMetrics;
    const handleDeleteAll = () => {
      const deletedReport = deleteReport(report);
      setReport(deletedReport);
      if (session) setSession(deleteSessionData(session));
      setShowDeleteConfirm(false);
    };

    const handleExport = () => {
      const json = exportReportAsJSON(report);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial-report-${report.reportId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">📋 Field Trial Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">{report.scenario.replace(/_/g, ' ')} · {report.formattedDuration}</p>
        </div>

        {report.emergencyStopUsed && (
          <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300">
            ⛔ Emergency Stop was triggered during this session.
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Alerts', val: report.alertsTriggered },
            { label: 'Silence Dec.', val: report.silenceDecisions },
            { label: 'Feedbacks', val: report.feedbackCount },
            { label: 'Incidents', val: report.incidentCount },
            { label: 'Sup. Notes', val: report.supervisorNoteCount },
            { label: 'Emergency', val: report.emergencyStopUsed ? 'Yes' : 'No' },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Safety metrics */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <h2 className="text-xs font-bold text-gray-400 mb-2">Safety Metrics</h2>
          {[
            { label: 'Alert Usefulness', val: m.alertUsefulnessScore },
            { label: 'Guidance Clarity', val: m.guidanceClarityScore },
            { label: 'User Confidence', val: m.userConfidenceScore },
            { label: 'Supervisor Safety', val: m.supervisorSafetyScore },
            { label: 'Alert Fatigue', val: m.alertFatigueScore, inverted: true },
            { label: 'Missed Hazards (est.)', val: m.missedHazardScore, inverted: true },
          ].map(({ label, val, inverted }) => (
            <div key={label} className="flex justify-between text-xs py-1 border-b border-gray-800">
              <span className="text-gray-400">{label}</span>
              <span className={inverted ? (val > 30 ? 'text-red-400' : 'text-green-400') : (val >= 70 ? 'text-green-400' : val >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                {formatMetricsGrade(val)}
              </span>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-xs font-bold text-gray-400 mb-2">Recommendations</h2>
          <ul className="space-y-1">
            {report.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-gray-300">• {r}</li>
            ))}
          </ul>
        </div>

        {/* Privacy guarantees */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-xs font-bold text-gray-400 mb-2">Privacy Guarantees</h2>
          <ul className="space-y-0.5">
            {report.privacyGuarantees.map((g, i) => (
              <li key={i} className="text-xs text-gray-500">✓ {g}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex-1 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold">
            ↓ Export JSON
          </button>
          <button onClick={() => { setPhase('consent'); setSession(null); setReport(null); }} className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold">
            New Trial
          </button>
        </div>

        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2 rounded-xl border border-red-800 text-red-400 hover:bg-red-950 text-xs">
            🗑 Delete All Session Data
          </button>
        ) : (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-300 font-semibold">Permanently delete all session data and redact this report?</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteAll} className="flex-1 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm font-bold">
                Yes, Delete Everything
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-gray-700 rounded-lg text-white text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
