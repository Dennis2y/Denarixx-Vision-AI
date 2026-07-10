// ─── V17 Field Trial Engine ───────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Session lifecycle, consent validation, alert recording, emergency stop.

import type {
  TrialSession,
  TrialConsent,
  TrialScenario,
  TrialScenarioInfo,
  TrialAlert,
  TrialSilenceDecision,
  AlertFeedback,
  IncidentReport,
  SupervisorNote,
} from '@/types/fieldTrial';
import { TRIAL_SCENARIO_REGISTRY, TRIAL_PRIVACY } from '@/types/fieldTrial';

// ─── Consent Validation ───────────────────────────────────────────────────────

export interface ConsentValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateConsent(consent: TrialConsent): ConsentValidationResult {
  const violations: string[] = [];

  if (!consent.consentGiven) violations.push('Participant consent not given');
  if (!consent.supervisorPresent) violations.push('Human supervisor must be present');
  if (!consent.assistiveSupportOnly) violations.push('Assistive support disclaimer not accepted');
  if (!consent.noVideoStorageConfirmed) violations.push('No-video-storage confirmation required');
  if (!consent.noFaceRecognitionConfirmed) violations.push('No-face-recognition confirmation required');
  if (!consent.participantId || consent.participantId.trim() === '') {
    violations.push('Anonymized participant ID required');
  }

  return { valid: violations.length === 0, violations };
}

// ─── Session Lifecycle ────────────────────────────────────────────────────────

export function createTrialSession(
  consent: TrialConsent,
  scenario: TrialScenario,
): TrialSession {
  const validation = validateConsent(consent);
  if (!validation.valid) {
    throw new Error(`Cannot create session: ${validation.violations.join('; ')}`);
  }

  return {
    sessionId: generateSessionId(),
    participantId: consent.participantId,
    scenario,
    phase: 'setup',
    consent,
    startTime: null,
    endTime: null,
    alerts: [],
    silenceDecisions: [],
    alertFeedbacks: [],
    incidentReports: [],
    supervisorNotes: [],
    emergencyStopUsed: false,
    hardwareMode: 'phone_only',
  };
}

export function startTrialSession(session: TrialSession): TrialSession {
  if (session.phase !== 'setup') {
    throw new Error(`Cannot start session in phase: ${session.phase}`);
  }
  return { ...session, phase: 'active', startTime: Date.now() };
}

export function endTrialSession(session: TrialSession): TrialSession {
  if (session.phase !== 'active') {
    throw new Error(`Cannot end session in phase: ${session.phase}`);
  }
  return { ...session, phase: 'completed', endTime: Date.now() };
}

export function triggerEmergencyStop(session: TrialSession): TrialSession {
  return {
    ...session,
    phase: 'completed',
    emergencyStopUsed: true,
    endTime: session.endTime ?? Date.now(),
  };
}

// ─── Data Recording ───────────────────────────────────────────────────────────

export function recordTrialAlert(
  session: TrialSession,
  alert: Omit<TrialAlert, 'alertId'>,
): TrialSession {
  const newAlert: TrialAlert = {
    alertId: `alert-${Date.now()}-${session.alerts.length}`,
    ...alert,
  };
  return { ...session, alerts: [...session.alerts, newAlert] };
}

export function recordSilenceDecision(
  session: TrialSession,
  decision: Omit<TrialSilenceDecision, 'decisionId' | 'sessionId'>,
): TrialSession {
  const d: TrialSilenceDecision = {
    decisionId: `silence-${Date.now()}-${session.silenceDecisions.length}`,
    sessionId: session.sessionId,
    ...decision,
  };
  return { ...session, silenceDecisions: [...session.silenceDecisions, d] };
}

export function addAlertFeedback(
  session: TrialSession,
  feedback: AlertFeedback,
): TrialSession {
  return { ...session, alertFeedbacks: [...session.alertFeedbacks, feedback] };
}

export function addIncidentReport(
  session: TrialSession,
  incident: Omit<IncidentReport, 'incidentId' | 'sessionId'>,
): TrialSession {
  const inc: IncidentReport = {
    incidentId: `incident-${Date.now()}-${session.incidentReports.length}`,
    sessionId: session.sessionId,
    ...incident,
  };
  return { ...session, incidentReports: [...session.incidentReports, inc] };
}

export function addSupervisorNote(
  session: TrialSession,
  note: Omit<SupervisorNote, 'noteId' | 'sessionId'>,
): TrialSession {
  const n: SupervisorNote = {
    noteId: `note-${Date.now()}-${session.supervisorNotes.length}`,
    sessionId: session.sessionId,
    ...note,
  };
  return { ...session, supervisorNotes: [...session.supervisorNotes, n] };
}

// ─── Privacy — Delete Session Data ───────────────────────────────────────────

export function deleteSessionData(session: TrialSession): TrialSession {
  return {
    ...session,
    phase: 'deleted',
    participantId: '[deleted]',
    consent: {
      ...session.consent,
      participantId: '[deleted]',
    },
    alerts: [],
    silenceDecisions: [],
    alertFeedbacks: [],
    incidentReports: [],
    supervisorNotes: [],
  };
}

// ─── Scenario Registry ────────────────────────────────────────────────────────

export function getScenarioInfo(scenario: TrialScenario): TrialScenarioInfo {
  const info = TRIAL_SCENARIO_REGISTRY.find(s => s.id === scenario);
  if (!info) throw new Error(`Unknown scenario: ${scenario}`);
  return info;
}

export function getScenarioList(): TrialScenarioInfo[] {
  return TRIAL_SCENARIO_REGISTRY;
}

export function getScenariosByRiskLevel(level: 'low' | 'medium' | 'high'): TrialScenarioInfo[] {
  return TRIAL_SCENARIO_REGISTRY.filter(s => s.riskLevel === level);
}

// ─── Duration ─────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function getSessionDurationMs(session: TrialSession): number {
  if (!session.startTime) return 0;
  const end = session.endTime ?? Date.now();
  return end - session.startTime;
}

// ─── Hardware Mode ────────────────────────────────────────────────────────────

export function setHardwareMode(session: TrialSession, mode: string): TrialSession {
  return { ...session, hardwareMode: mode };
}

// ─── Privacy Checks ───────────────────────────────────────────────────────────

export function isPrivacyCompliant(session: TrialSession): boolean {
  return (
    TRIAL_PRIVACY.consentRequired && session.consent.consentGiven &&
    TRIAL_PRIVACY.supervisorRequired && session.consent.supervisorPresent &&
    session.consent.noVideoStorageConfirmed &&
    session.consent.noFaceRecognitionConfirmed
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `trial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
