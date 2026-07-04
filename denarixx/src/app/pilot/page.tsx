'use client';

import { useState, useCallback } from 'react';
import {
  SCENARIO_REGISTRY,
  validateConsent,
  formatDuration,
} from '@/engines/pilotTestingEngine';
import { PILOT_PRIVACY } from '@/types/pilot';
import type {
  PilotScenario,
  TesterConsent,
  AlertFeedback,
  PilotReport,
  PilotPhase,
} from '@/types/pilot';

// ─── Safety Disclaimer Text ─────────────────────────────────────────────────
const DISCLAIMER_LINES = [
  'Denarixx Vision AI is NOT a medically certified product.',
  'This is an assistive support tool only — it may make mistakes.',
  'A trained human supervisor must be physically present at all times.',
  'The participant may stop the session at any moment without consequence.',
  'No video is stored. No faces are identified. No data leaves this device.',
  'Do not use in high-risk environments (real roads, stairs without support).',
  'Testing must be in a safe, controlled, pre-checked environment.',
];

// ─── Feedback questions ──────────────────────────────────────────────────────
type FbKey = 'wasUseful' | 'wasTooLate' | 'wasAnnoying' | 'feltSafe' | 'wordingClear';
const FEEDBACK_QUESTIONS: { key: FbKey; question: string }[] = [
  { key: 'wasUseful', question: 'Was this alert useful?' },
  { key: 'wasTooLate', question: 'Did it arrive too late?' },
  { key: 'wasAnnoying', question: 'Was it annoying?' },
  { key: 'feltSafe', question: 'Did it help you feel safe?' },
  { key: 'wordingClear', question: 'Was the wording clear?' },
];

function TriBtn({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex gap-2">
      {(['Yes', 'No'] as const).map((label) => {
        const bool = label === 'Yes';
        const active = value === bool;
        return (
          <button
            key={label}
            onClick={() => onChange(active ? null : bool)}
            className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? bool
                  ? 'bg-green-500/20 border-green-500 text-green-300'
                  : 'bg-red-500/20 border-red-500 text-red-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function PilotPage() {
  const [phase, setPhase] = useState<PilotPhase>('consent');
  const [selectedScenario, setSelectedScenario] = useState<PilotScenario | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [report, setReport] = useState<PilotReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  // Consent state
  const [consentGiven, setConsentGiven] = useState(false);
  const [supervisorPresent, setSupervisorPresent] = useState(false);
  const [disclaimerAck, setDisclaimerAck] = useState(false);

  // Feedback state (per-session inline)
  const [feedback, setFeedback] = useState<Partial<Record<FbKey, boolean | null>>>({});
  const [suggestedWording, setSuggestedWording] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Emergency stop
  const handleEmergencyStop = useCallback(() => {
    setError(null);
    setPhase('consent');
    setSessionId(null);
    setSessionStart(null);
    setFeedback({});
    setSuggestedWording('');
    setFeedbackSubmitted(false);
  }, []);

  // ── Consent → Scenario ──
  const handleConsentNext = () => {
    const consent: TesterConsent = {
      testerId: `tester-${Date.now()}`,
      consentGiven,
      consentTimestamp: new Date().toISOString(),
      supervisorPresent,
      safetyDisclaimerAcknowledged: disclaimerAck,
    };
    const result = validateConsent(consent);
    if (!result.valid) {
      setError(result.errors.join(' '));
      return;
    }
    setError(null);
    setPhase('scenario');
  };

  // ── Scenario → Active ──
  const handleStartSession = async () => {
    if (!selectedScenario) return;
    setLoading(true);
    setError(null);
    try {
      const consent: TesterConsent = {
        testerId: `tester-${Date.now()}`,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
        supervisorPresent: true,
        safetyDisclaimerAcknowledged: true,
      };
      const res = await fetch('/api/pilot/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenario, consent }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { sessionId: string }; error?: string };
      if (!json.ok || !json.data) throw new Error(json.error ?? 'Failed to start session');
      setSessionId(json.data.sessionId);
      setSessionStart(Date.now());
      setPhase('active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit Feedback + End Session → Report ──
  const handleEndSession = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // Submit feedback if any answers provided
      const hasFeedback = Object.values(feedback).some((v) => v !== undefined);
      if (hasFeedback || suggestedWording.trim()) {
        const fb: AlertFeedback = {
          alertId: `feedback-${Date.now()}`,
          wasUseful: feedback.wasUseful ?? null,
          wasTooLate: feedback.wasTooLate ?? null,
          wasAnnoying: feedback.wasAnnoying ?? null,
          feltSafe: feedback.feltSafe ?? null,
          wordingClear: feedback.wordingClear ?? null,
          suggestedWording: suggestedWording.trim() || null,
          timestamp: new Date().toISOString(),
        };
        await fetch('/api/pilot/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, feedback: fb }),
        });
        setFeedbackSubmitted(true);
      }

      // End session + generate report
      const res = await fetch('/api/pilot/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'report' }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { report: PilotReport }; error?: string };
      if (!json.ok || !json.data) throw new Error(json.error ?? 'Failed to generate report');
      setReport(json.data.report);
      setPhase('report');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete session data ──
  const handleDeleteData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await fetch(`/api/pilot/session?id=${sessionId}`, { method: 'DELETE' });
      setDeleted(true);
      setReport(null);
    } catch (_e) {
      // best-effort
    } finally {
      setLoading(false);
    }
  };

  const elapsed = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-yellow-400">🧪 Pilot Testing Mode</h1>
          <p className="text-gray-400 text-sm">Safe, supervised, consent-based. Assistive support only.</p>
        </div>

        {/* NOT MEDICAL DEVICE banner */}
        <div className="bg-red-950 border border-red-700 rounded-xl px-5 py-3 text-center">
          <p className="text-red-300 text-sm font-semibold uppercase tracking-wider">
            ⚠️ NOT a medical device — assistive support only
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl px-5 py-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* ── CONSENT PHASE ──────────────────────────────────────────────── */}
        {phase === 'consent' && (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Safety Disclaimer</h2>
              <ul className="space-y-2">
                {DISCLAIMER_LINES.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Consent &amp; Readiness</h2>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disclaimerAck}
                  onChange={(e) => setDisclaimerAck(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-yellow-400"
                />
                <span className="text-sm text-gray-300">
                  I have read and understood the safety disclaimer above.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supervisorPresent}
                  onChange={(e) => setSupervisorPresent(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-yellow-400"
                />
                <span className="text-sm text-gray-300">
                  A trained human supervisor is physically present and ready to intervene.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-yellow-400"
                />
                <span className="text-sm text-gray-300">
                  The participant gives informed consent to take part in this pilot test.
                </span>
              </label>

              <button
                onClick={handleConsentNext}
                disabled={!consentGiven || !supervisorPresent || !disclaimerAck}
                className="w-full py-3 rounded-xl font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Proceed to Scenario Selection →
              </button>
            </div>
          </div>
        )}

        {/* ── SCENARIO PHASE ─────────────────────────────────────────────── */}
        {phase === 'scenario' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Choose a Test Scenario</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.values(SCENARIO_REGISTRY) as import('@/types/pilot').ScenarioInfo[]).map((info) => {
                const selected = selectedScenario === info.id;
                const diffColor =
                  info.difficulty === 'low'
                    ? 'text-green-400'
                    : info.difficulty === 'medium'
                    ? 'text-yellow-400'
                    : 'text-red-400';
                return (
                  <button
                    key={info.id}
                    onClick={() => setSelectedScenario(info.id)}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      selected
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">{info.label}</span>
                      <span className={`text-xs font-medium ${diffColor} capitalize`}>{info.difficulty}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{info.description}</p>
                    <p className="text-xs text-gray-500">~{info.estimatedMinutes} min</p>
                  </button>
                );
              })}
            </div>

            {selectedScenario && (
              <div className="bg-gray-900 border border-yellow-700/40 rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-yellow-400 text-sm">Safety Notes for This Scenario</h3>
                <ul className="space-y-1">
                  {SCENARIO_REGISTRY[selectedScenario].safetyNotes.map((note) => (
                    <li key={note} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-yellow-500 shrink-0">⚠</span>
                      {note}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleStartSession}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Starting…' : 'Begin Pilot Session →'}
                </button>
              </div>
            )}

            <button
              onClick={() => setPhase('consent')}
              className="text-gray-500 text-sm hover:text-gray-300 underline"
            >
              ← Back to Consent
            </button>
          </div>
        )}

        {/* ── ACTIVE PHASE ───────────────────────────────────────────────── */}
        {phase === 'active' && selectedScenario && (
          <div className="space-y-5">
            {/* Status bar */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Active Scenario</p>
                <p className="font-semibold text-white">{SCENARIO_REGISTRY[selectedScenario].label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Elapsed</p>
                <p className="font-mono text-yellow-400">{Math.floor(elapsed / 60)}m {elapsed % 60}s</p>
              </div>
            </div>

            {/* Emergency stop — always prominent */}
            <button
              onClick={handleEmergencyStop}
              className="w-full py-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xl font-black tracking-wide transition-colors"
              style={{ minHeight: 72 }}
            >
              🛑 EMERGENCY STOP
            </button>

            {/* Supervisor reminder */}
            <div className="bg-blue-950 border border-blue-700/50 rounded-xl px-5 py-3 text-center">
              <p className="text-blue-300 text-sm">👤 Supervisor must remain within arm&apos;s reach at all times</p>
            </div>

            {/* Feedback collection */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
              <h2 className="text-lg font-bold text-white">Session Feedback</h2>
              <p className="text-gray-400 text-sm">Answer what you can — all questions are optional.</p>

              {FEEDBACK_QUESTIONS.map(({ key, question }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-300 flex-1">{question}</span>
                  <TriBtn
                    value={feedback[key] ?? null}
                    onChange={(v) => setFeedback((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-sm text-gray-300">What should the AI say differently?</label>
                <textarea
                  value={suggestedWording}
                  onChange={(e) => setSuggestedWording(e.target.value)}
                  placeholder="Optional — describe what you'd prefer the AI to say…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            <button
              onClick={handleEndSession}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Generating Report…' : 'End Session & Generate Report'}
            </button>
          </div>
        )}

        {/* ── REPORT PHASE ───────────────────────────────────────────────── */}
        {phase === 'report' && (
          <div className="space-y-5">
            {deleted ? (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center space-y-3">
                <p className="text-4xl">🗑️</p>
                <h2 className="text-xl font-bold text-white">Session Data Deleted</h2>
                <p className="text-gray-400 text-sm">
                  All pilot session data has been permanently removed from this device.
                </p>
                <button
                  onClick={() => {
                    setPhase('consent');
                    setSelectedScenario(null);
                    setReport(null);
                    setDeleted(false);
                    setConsentGiven(false);
                    setSupervisorPresent(false);
                    setDisclaimerAck(false);
                    setFeedback({});
                    setSuggestedWording('');
                    setFeedbackSubmitted(false);
                  }}
                  className="px-6 py-2 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors"
                >
                  Start New Test
                </button>
              </div>
            ) : report ? (
              <>
                <h2 className="text-xl font-bold text-white">📋 Pilot Session Report</h2>

                {/* Privacy guarantees */}
                <div className="bg-green-950 border border-green-700/50 rounded-xl px-5 py-3 space-y-1">
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">Privacy Guarantees</p>
                  {Object.entries(PILOT_PRIVACY).map(([k, v]) => (
                    <p key={k} className="text-green-300 text-xs flex gap-2">
                      <span>{v ? '✓' : '✗'}</span>
                      <span>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                    </p>
                  ))}
                </div>

                {/* Session summary */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Scenario', SCENARIO_REGISTRY[report.scenario]?.label ?? report.scenario],
                      ['Duration', formatDuration(report.durationMs)],
                      ['Alerts Triggered', String(report.alertsTriggered)],
                      ['Silence Decisions', String(report.silenceDecisions)],
                      ['Avg Confidence', `${Math.round(report.averageConfidence * 100)}%`],
                      ['Feedback Responses', String(report.feedbackSummary.totalResponses)],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback summary */}
                {report.feedbackSummary.totalResponses > 0 && (
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-3">
                    <h3 className="font-semibold text-white">Feedback Summary</h3>
                    {([
                      ['Useful', report.feedbackSummary.usefulPercent],
                      ['Too Late', report.feedbackSummary.tooLatePercent],
                      ['Annoying', report.feedbackSummary.annoyingPercent],
                      ['Felt Safe', report.feedbackSummary.feltSafePercent],
                      ['Wording Clear', report.feedbackSummary.wordingClearPercent],
                    ] as [string, number][]).map(([label, pct]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{label}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {report.feedbackSummary.suggestions.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Suggested Wording</p>
                        {report.feedbackSummary.suggestions.map((s, i) => (
                          <p key={i} className="text-sm text-gray-300 italic">&ldquo;{s}&rdquo;</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Failed detections */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-2">
                  <h3 className="font-semibold text-white">Known Detection Limits</h3>
                  <p className="text-xs text-gray-500 mb-2">These are known limitations to note for future AI improvements.</p>
                  {report.failedDetections.map((fd) => (
                    <p key={fd} className="text-sm text-gray-400 flex gap-2">
                      <span className="text-gray-600">—</span> {fd}
                    </p>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setPhase('consent');
                      setSelectedScenario(null);
                      setReport(null);
                      setConsentGiven(false);
                      setSupervisorPresent(false);
                      setDisclaimerAck(false);
                      setFeedback({});
                      setSuggestedWording('');
                      setFeedbackSubmitted(false);
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-black bg-yellow-400 hover:bg-yellow-300 transition-colors"
                  >
                    Start New Test
                  </button>
                  <button
                    onClick={handleDeleteData}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-semibold text-red-400 border border-red-700 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                  >
                    {loading ? 'Deleting…' : '🗑️ Delete Session Data'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-center">Loading report…</p>
            )}
          </div>
        )}

        {feedbackSubmitted && phase === 'report' && !deleted && (
          <p className="text-center text-xs text-green-400">✓ Feedback saved to this session report</p>
        )}
      </div>
    </div>
  );
}
