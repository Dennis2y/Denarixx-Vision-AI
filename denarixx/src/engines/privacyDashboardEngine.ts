// Sprint 12 — Privacy Dashboard Engine (pure functional, no async, no I/O)
// Dashboard state, summary computation, export, and deletion orchestration.

import type {
  PrivacyDashboardState,
  PrivacySummary,
  ConsentItem,
  AuditEvent,
  DataSummary,
  PrivacyExport,
} from '@/types/privacy';
import {
  PRIVACY_DISCLAIMER,
  PRIVACY_VERSION,
} from '@/types/privacy';
import { CONSENT_REGISTRY } from '@/engines/consentManagementEngine';
import {
  getGrantedConsents,
  getDeniedConsents,
  getPlaceholderConsents,
  getHighImpactGranted,
} from '@/engines/consentManagementEngine';
import { buildDemoDataSummary, buildRetentionReport } from '@/engines/dataRetentionEngine';
import { getLastEvent, logPrivacyReset, logDataExported } from '@/engines/permissionAuditEngine';

// ─── Dashboard state factory ─────────────────────────────────────────────────

export function createDashboardState(): PrivacyDashboardState {
  const consents = CONSENT_REGISTRY.map(c => ({ ...c }));
  const now = new Date().toISOString();
  const dataSummary = buildDemoDataSummary();
  const retentionReport = buildRetentionReport(now);

  return {
    consents,
    auditLog: [],
    dataSummary,
    retentionReport,
    lastReset: null,
    exportAvailable: true,
  };
}

// ─── Privacy summary (header stats) ──────────────────────────────────────────

export function buildPrivacySummary(
  consents: ConsentItem[],
  auditLog: AuditEvent[],
): PrivacySummary {
  const granted = getGrantedConsents(consents);
  const denied = getDeniedConsents(consents);
  const placeholder = getPlaceholderConsents(consents);
  const highImpact = getHighImpactGranted(consents);

  const overallRisk: PrivacySummary['overallRisk'] =
    highImpact.length >= 2 ? 'high'
    : highImpact.length === 1 || granted.length > 5 ? 'medium'
    : 'low';

  return {
    grantedCount: granted.length,
    deniedCount: denied.length,
    placeholderCount: placeholder.length,
    highImpactGranted: highImpact.length,
    overallRisk,
    lastAuditEvent: getLastEvent(auditLog),
  };
}

// ─── Data summary updates ─────────────────────────────────────────────────────

export function clearMemories(summary: DataSummary): DataSummary {
  return {
    ...summary,
    memoriesCount: 0,
    totalItemCount: summary.totalItemCount - summary.memoriesCount,
  };
}

export function clearSavedPlaces(summary: DataSummary): DataSummary {
  return {
    ...summary,
    savedPlacesCount: 0,
    totalItemCount: summary.totalItemCount - summary.savedPlacesCount,
  };
}

export function clearNavigationHistory(summary: DataSummary): DataSummary {
  return {
    ...summary,
    navigationHistoryCount: 0,
    totalItemCount: summary.totalItemCount - summary.navigationHistoryCount,
  };
}

export function deleteAllData(summary: DataSummary): DataSummary {
  return {
    memoriesCount: 0,
    savedPlacesCount: 0,
    navigationHistoryCount: 0,
    aiActivityCount: 0,
    retentionStatus: 'healthy',
    oldestDataAge: null,
    totalItemCount: 0,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function buildPrivacyExport(
  state: PrivacyDashboardState,
): PrivacyExport {
  return {
    exportedAt: new Date().toISOString(),
    version: PRIVACY_VERSION,
    consents: state.consents.map(c => ({ ...c })),
    auditLogSample: state.auditLog.slice(-20).map(e => ({ ...e })),
    dataSummary: { ...state.dataSummary },
    privacyNote: PRIVACY_DISCLAIMER,
    disclaimer:
      'This export is a simulation. In production, this would be a ' +
      'GDPR Article 20-compliant machine-readable data export.',
  };
}

export function exportAsJson(state: PrivacyDashboardState): string {
  const payload = buildPrivacyExport(state);
  return JSON.stringify(payload, null, 2);
}

// ─── Reset privacy settings ───────────────────────────────────────────────────

export function resetPrivacySettings(
  state: PrivacyDashboardState,
): PrivacyDashboardState {
  const now = new Date().toISOString();
  const freshConsents = CONSENT_REGISTRY.map(c => ({ ...c }));
  const newLog = logPrivacyReset(state.auditLog, now);
  return {
    ...state,
    consents: freshConsents,
    auditLog: newLog,
    lastReset: now,
  };
}

// ─── Risk label ───────────────────────────────────────────────────────────────

export function riskLabel(risk: PrivacySummary['overallRisk']): string {
  const labels = { low: 'Low Privacy Risk', medium: 'Moderate Privacy Risk', high: 'Higher Privacy Risk' };
  return labels[risk];
}

export function riskColor(risk: PrivacySummary['overallRisk']): string {
  const colors = { low: 'text-green-400', medium: 'text-yellow-400', high: 'text-red-400' };
  return colors[risk];
}

// ─── Data age helper ──────────────────────────────────────────────────────────

export function retentionStatusLabel(status: DataSummary['retentionStatus']): string {
  const labels = {
    healthy: 'All data within retention limits',
    expiring_soon: 'Some data expiring soon',
    overdue: 'Some data past retention limit',
  };
  return labels[status];
}
