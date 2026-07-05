// Sprint 12 — Privacy Dashboard & Consent Management Tests
// Run: cd denarixx && npx tsx tests/privacyDashboard.test.ts

import {
  CONSENT_REGISTRY,
  getConsent,
  getAllConsents,
  getToggleableConsents,
  getPlaceholderConsents,
  hasConsentFor,
  getConsentStatus,
  getGrantedConsents,
  getDeniedConsents,
  getHighImpactGranted,
  grantConsent,
  revokeConsent,
  toggleConsent,
  resetAllConsents,
  impactLabel,
  impactColor,
  statusLabel,
} from '../src/engines/consentManagementEngine';
import {
  createAuditEvent,
  _resetAuditIdCounter,
  appendAuditEvent,
  logPermissionGranted,
  logPermissionRevoked,
  logMemoryCreated,
  logMemoryDeleted,
  logSettingsChanged,
  logNavigationExported,
  logPrivacyReset,
  logDataExported,
  logDataDeleted,
  logAuditCleared,
  getRecentEvents,
  getEventsByType,
  getLastEvent,
  buildAuditSummary,
  auditEventIcon,
} from '../src/engines/permissionAuditEngine';
import {
  RETENTION_RULES,
  policyToDays,
  policyLabel,
  getRetentionRule,
  isExpired,
  isExpiringSoon,
  daysUntilExpiry,
  canDeleteCategory,
  simulateDeletion,
  simulateDeleteAll,
  buildRetentionReport,
  buildDemoDataSummary,
} from '../src/engines/dataRetentionEngine';
import {
  createDashboardState,
  buildPrivacySummary,
  clearMemories,
  clearNavigationHistory,
  deleteAllData,
  buildPrivacyExport,
  exportAsJson,
  resetPrivacySettings,
  riskLabel,
  riskColor,
} from '../src/engines/privacyDashboardEngine';
import { PRIVACY_DISCLAIMER, PRIVACY_VERSION } from '../src/types/privacy';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`  ✗ ${name}\n    → ${msg}`);
    process.stdout.write(`  ✗ ${name}\n    → ${msg}\n`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: T) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan: (n: number) => {
      if ((actual as number) <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeGreaterThanOrEqual: (n: number) => {
      if ((actual as number) < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeLessThan: (n: number) => {
      if ((actual as number) >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toContain: (sub: string) => {
      if (!(actual as string).includes(sub)) throw new Error(`Expected "${actual}" to contain "${sub}"`);
    },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${actual}`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got ${actual}`); },
    toBeNull: () => { if (actual !== null) throw new Error(`Expected null, got ${actual}`); },
    toHaveLength: (n: number) => {
      const len = (actual as unknown[]).length;
      if (len !== n) throw new Error(`Expected length ${n}, got ${len}`);
    },
  };
}

function section(name: string) { process.stdout.write(`\n${name}\n`); }

// ─── Section 1: Consent registry ──────────────────────────────────────────────

section('Section 1: Consent registry');

test('CONSENT_REGISTRY has 10 items', () => {
  expect(CONSENT_REGISTRY).toHaveLength(10);
});

test('All consent items have required fields', () => {
  for (const c of CONSENT_REGISTRY) {
    if (!c.id || !c.name || !c.reason) throw new Error(`Missing required fields on ${c.id}`);
  }
});

test('camera consent is granted by default', () => {
  const c = CONSENT_REGISTRY.find(c => c.id === 'camera');
  expect(c?.status).toBe('granted');
});

test('voice_companion consent is granted by default', () => {
  const c = CONSENT_REGISTRY.find(c => c.id === 'voice_companion');
  expect(c?.status).toBe('granted');
});

test('face_recognition is a placeholder', () => {
  const c = CONSENT_REGISTRY.find(c => c.id === 'face_recognition');
  expect(c?.isPlaceholder).toBe(true);
  expect(c?.status).toBe('placeholder');
});

test('cloud_sync is a placeholder', () => {
  const c = CONSENT_REGISTRY.find(c => c.id === 'cloud_sync');
  expect(c?.isPlaceholder).toBe(true);
});

test('Placeholders are not toggleable', () => {
  const placeholders = CONSENT_REGISTRY.filter(c => c.isPlaceholder);
  for (const p of placeholders) {
    if (p.isToggleable) throw new Error(`${p.id} placeholder should not be toggleable`);
  }
});

// ─── Section 2: Consent queries ───────────────────────────────────────────────

section('Section 2: Consent queries');

test('getConsent("camera") returns camera item', () => {
  const c = getConsent(CONSENT_REGISTRY, 'camera');
  expect(c?.id).toBe('camera');
});

test('getConsent("unknown") returns undefined', () => {
  const c = getConsent(CONSENT_REGISTRY, 'unknown');
  expect(c === undefined).toBe(true);
});

test('getAllConsents returns copy of all 10', () => {
  expect(getAllConsents(CONSENT_REGISTRY)).toHaveLength(10);
});

test('getToggleableConsents excludes placeholders', () => {
  const t = getToggleableConsents(CONSENT_REGISTRY);
  for (const c of t) {
    if (c.isPlaceholder) throw new Error(`Placeholder ${c.id} in toggleable list`);
  }
});

test('getPlaceholderConsents returns 2 items', () => {
  expect(getPlaceholderConsents(CONSENT_REGISTRY)).toHaveLength(2);
});

test('hasConsentFor("camera") returns true', () => {
  expect(hasConsentFor(CONSENT_REGISTRY, 'camera')).toBe(true);
});

test('hasConsentFor("microphone") returns false (not_requested)', () => {
  expect(hasConsentFor(CONSENT_REGISTRY, 'microphone')).toBe(false);
});

test('getConsentStatus("camera") returns granted', () => {
  expect(getConsentStatus(CONSENT_REGISTRY, 'camera')).toBe('granted');
});

test('getConsentStatus("face_recognition") returns placeholder', () => {
  expect(getConsentStatus(CONSENT_REGISTRY, 'face_recognition')).toBe('placeholder');
});

test('getGrantedConsents returns items with granted status', () => {
  const granted = getGrantedConsents(CONSENT_REGISTRY);
  for (const c of granted) {
    if (c.status !== 'granted') throw new Error(`Non-granted item ${c.id} in granted list`);
  }
  expect(granted.length).toBeGreaterThan(0);
});

test('getDeniedConsents returns empty for fresh registry', () => {
  expect(getDeniedConsents(CONSENT_REGISTRY)).toHaveLength(0);
});

test('getHighImpactGranted returns camera (high impact, granted)', () => {
  const high = getHighImpactGranted(CONSENT_REGISTRY);
  const ids = high.map(c => c.id);
  expect(ids.includes('camera')).toBe(true);
});

// ─── Section 3: Grant / revoke ────────────────────────────────────────────────

section('Section 3: Grant / revoke');

test('grantConsent("microphone") changes status to granted', () => {
  const updated = grantConsent(CONSENT_REGISTRY, 'microphone', '2026-01-01T00:00:00Z');
  const mic = updated.find(c => c.id === 'microphone');
  expect(mic?.status).toBe('granted');
});

test('grantConsent sets lastAccessed timestamp', () => {
  const ts = '2026-01-01T00:00:00Z';
  const updated = grantConsent(CONSENT_REGISTRY, 'microphone', ts);
  const mic = updated.find(c => c.id === 'microphone');
  expect(mic?.lastAccessed).toBe(ts);
});

test('grantConsent does not mutate original', () => {
  const before = CONSENT_REGISTRY.find(c => c.id === 'microphone')?.status;
  grantConsent(CONSENT_REGISTRY, 'microphone', '2026-01-01T00:00:00Z');
  const after = CONSENT_REGISTRY.find(c => c.id === 'microphone')?.status;
  expect(before).toBe(after);
});

test('revokeConsent("camera") changes status to denied', () => {
  const updated = revokeConsent(CONSENT_REGISTRY, 'camera');
  const cam = updated.find(c => c.id === 'camera');
  expect(cam?.status).toBe('denied');
});

test('revokeConsent does not affect other items', () => {
  const updated = revokeConsent(CONSENT_REGISTRY, 'camera');
  const voice = updated.find(c => c.id === 'voice_companion');
  expect(voice?.status).toBe('granted');
});

test('grantConsent on placeholder has no effect', () => {
  const updated = grantConsent(CONSENT_REGISTRY, 'face_recognition', '2026-01-01T00:00:00Z');
  const fr = updated.find(c => c.id === 'face_recognition');
  expect(fr?.status).toBe('placeholder');
});

test('revokeConsent on placeholder has no effect', () => {
  const updated = revokeConsent(CONSENT_REGISTRY, 'cloud_sync');
  const cs = updated.find(c => c.id === 'cloud_sync');
  expect(cs?.status).toBe('placeholder');
});

test('toggleConsent on granted → denied', () => {
  const updated = toggleConsent(CONSENT_REGISTRY, 'camera', '2026-01-01T00:00:00Z');
  expect(updated.find(c => c.id === 'camera')?.status).toBe('denied');
});

test('toggleConsent on denied → granted', () => {
  const revoked = revokeConsent(CONSENT_REGISTRY, 'camera');
  const toggled = toggleConsent(revoked, 'camera', '2026-01-01T00:00:00Z');
  expect(toggled.find(c => c.id === 'camera')?.status).toBe('granted');
});

test('resetAllConsents restores fresh registry', () => {
  const revoked = revokeConsent(CONSENT_REGISTRY, 'camera');
  const reset = resetAllConsents(CONSENT_REGISTRY);
  const cam = reset.find(c => c.id === 'camera');
  expect(cam?.status).toBe('granted');
});

test('impactLabel("high") returns human-readable string', () => {
  expect(impactLabel('high')).toBe('High impact');
});

test('statusLabel("placeholder") returns Coming soon', () => {
  expect(statusLabel('placeholder')).toBe('Coming soon');
});

// ─── Section 4: Audit engine ──────────────────────────────────────────────────

section('Section 4: Audit engine');

beforeTest();
function beforeTest() { _resetAuditIdCounter(); }
_resetAuditIdCounter();

test('createAuditEvent creates event with correct type', () => {
  const e = createAuditEvent('permission_granted', 'Camera enabled');
  expect(e.type).toBe('permission_granted');
  expect(e.description).toBe('Camera enabled');
});

test('createAuditEvent uses provided timestamp', () => {
  const ts = '2026-01-01T10:00:00Z';
  const e = createAuditEvent('settings_changed', 'Changed', {}, ts);
  expect(e.timestamp).toBe(ts);
});

test('appendAuditEvent adds to log', () => {
  const log = appendAuditEvent([], createAuditEvent('privacy_reset', 'Reset'));
  expect(log).toHaveLength(1);
});

test('appendAuditEvent enforces ring-buffer size', () => {
  let log: ReturnType<typeof createAuditEvent>[] = [];
  for (let i = 0; i < 110; i++) {
    log = appendAuditEvent(log, createAuditEvent('settings_changed', `Event ${i}`));
  }
  expect(log).toHaveLength(100);
});

test('appendAuditEvent keeps most recent events', () => {
  let log: ReturnType<typeof createAuditEvent>[] = [];
  for (let i = 0; i < 105; i++) {
    log = appendAuditEvent(log, createAuditEvent('settings_changed', `Event ${i}`));
  }
  expect(log[99].description).toBe('Event 104');
});

test('logPermissionGranted adds event to log', () => {
  const log = logPermissionGranted([], 'camera', 'Camera');
  expect(log).toHaveLength(1);
  expect(log[0].type).toBe('permission_granted');
  expect(log[0].metadata.consentId).toBe('camera');
});

test('logPermissionRevoked adds revocation event', () => {
  const log = logPermissionRevoked([], 'camera', 'Camera');
  expect(log[0].type).toBe('permission_revoked');
});

test('logMemoryCreated adds memory event', () => {
  const log = logMemoryCreated([], 'mem_001');
  expect(log[0].type).toBe('memory_created');
  expect(log[0].metadata.memoryId).toBe('mem_001');
});

test('logMemoryDeleted adds deletion event', () => {
  const log = logMemoryDeleted([], 'mem_001');
  expect(log[0].type).toBe('memory_deleted');
});

test('logSettingsChanged records old and new value', () => {
  const log = logSettingsChanged([], 'speechRate', '1.0', '1.5');
  expect(log[0].metadata.oldValue).toBe('1.0');
  expect(log[0].metadata.newValue).toBe('1.5');
});

test('logNavigationExported logs export event', () => {
  const log = logNavigationExported([]);
  expect(log[0].type).toBe('navigation_exported');
});

test('logPrivacyReset logs reset event', () => {
  const log = logPrivacyReset([]);
  expect(log[0].type).toBe('privacy_reset');
});

test('logDataExported logs export event', () => {
  const log = logDataExported([]);
  expect(log[0].type).toBe('data_exported');
});

test('logDataDeleted logs category in metadata', () => {
  const log = logDataDeleted([], 'memories');
  expect(log[0].metadata.category).toBe('memories');
});

test('logAuditCleared returns single cleared event', () => {
  const log = logAuditCleared();
  expect(log).toHaveLength(1);
  expect(log[0].type).toBe('audit_cleared');
});

test('getRecentEvents returns in reverse order', () => {
  let log = logPermissionGranted([], 'camera', 'Camera', '2026-01-01T00:00:00Z');
  log = logPermissionRevoked(log, 'camera', 'Camera', '2026-01-02T00:00:00Z');
  const recent = getRecentEvents(log, 1);
  expect(recent[0].type).toBe('permission_revoked');
});

test('getEventsByType filters correctly', () => {
  let log = logPermissionGranted([], 'camera', 'Camera');
  log = logPrivacyReset(log);
  log = logPermissionGranted(log, 'microphone', 'Microphone');
  const grants = getEventsByType(log, 'permission_granted');
  expect(grants).toHaveLength(2);
});

test('getLastEvent returns last item', () => {
  let log = logPermissionGranted([], 'camera', 'Camera');
  log = logPrivacyReset(log);
  const last = getLastEvent(log);
  expect(last?.type).toBe('privacy_reset');
});

test('getLastEvent returns null for empty log', () => {
  expect(getLastEvent([])).toBeNull();
});

test('buildAuditSummary counts permission changes', () => {
  let log = logPermissionGranted([], 'camera', 'Camera');
  log = logPermissionRevoked(log, 'camera', 'Camera');
  const summary = buildAuditSummary(log);
  expect(summary.permissionChanges).toBe(2);
});

test('buildAuditSummary counts settings changes', () => {
  const log = logSettingsChanged([], 'rate', '1.0', '1.5');
  const summary = buildAuditSummary(log);
  expect(summary.settingsChanges).toBe(1);
});

test('auditEventIcon returns icon for permission_granted', () => {
  expect(auditEventIcon('permission_granted')).toBe('✅');
});

test('auditEventIcon returns icon for permission_revoked', () => {
  expect(auditEventIcon('permission_revoked')).toBe('🚫');
});

// ─── Section 5: Data retention engine ────────────────────────────────────────

section('Section 5: Data retention engine');

test('RETENTION_RULES has 6 categories', () => {
  expect(RETENTION_RULES).toHaveLength(6);
});

test('policyToDays("7days") returns 7', () => {
  expect(policyToDays('7days')).toBe(7);
});

test('policyToDays("forever") returns null', () => {
  expect(policyToDays('forever')).toBeNull();
});

test('policyToDays("session") returns 0', () => {
  expect(policyToDays('session')).toBe(0);
});

test('policyLabel("30days") returns 30 days', () => {
  expect(policyLabel('30days')).toBe('30 days');
});

test('policyLabel("forever") returns Until reset', () => {
  expect(policyLabel('forever')).toBe('Until reset');
});

test('getRetentionRule("memories") returns correct rule', () => {
  const rule = getRetentionRule('memories');
  expect(rule?.policy).toBe('90days');
});

test('isExpired: session data is always expired', () => {
  expect(isExpired('session', '2026-01-01T00:00:00Z')).toBe(true);
});

test('isExpired: forever data is never expired', () => {
  expect(isExpired('forever', '2020-01-01T00:00:00Z')).toBe(false);
});

test('isExpired: 7day data created 8 days ago is expired', () => {
  const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  expect(isExpired('7days', createdAt)).toBe(true);
});

test('isExpired: 7day data created 3 days ago is not expired', () => {
  const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  expect(isExpired('7days', createdAt)).toBe(false);
});

test('isExpiringSoon: 7day data created 1 day ago is not expiring soon', () => {
  const createdAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  expect(isExpiringSoon('7days', createdAt)).toBe(false);
});

test('daysUntilExpiry: 7day data created yesterday ≈ 6 days remaining', () => {
  const createdAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const days = daysUntilExpiry('7days', createdAt);
  if (days === null) throw new Error('Expected number, got null');
  expect(days).toBeGreaterThan(4);
  expect(days).toBeLessThan(8);
});

test('daysUntilExpiry: forever policy returns null', () => {
  expect(daysUntilExpiry('forever', '2026-01-01T00:00:00Z')).toBeNull();
});

test('canDeleteCategory("memories") returns true', () => {
  expect(canDeleteCategory('memories')).toBe(true);
});

test('canDeleteCategory("preferences") returns false', () => {
  expect(canDeleteCategory('preferences')).toBe(false);
});

test('simulateDeletion clears memories count', () => {
  const summary = buildDemoDataSummary();
  const updated = simulateDeletion(summary, 'memories');
  expect(updated.memoriesCount).toBe(0);
  expect(updated.navigationHistoryCount).toBe(summary.navigationHistoryCount);
});

test('simulateDeletion updates totalItemCount', () => {
  const summary = buildDemoDataSummary();
  const updated = simulateDeletion(summary, 'memories');
  expect(updated.totalItemCount).toBe(
    summary.savedPlacesCount + summary.navigationHistoryCount + summary.aiActivityCount,
  );
});

test('simulateDeleteAll zeros all counts', () => {
  const summary = buildDemoDataSummary();
  const all = simulateDeleteAll(summary);
  expect(all.totalItemCount).toBe(0);
  expect(all.memoriesCount).toBe(0);
});

test('buildRetentionReport returns correct structure', () => {
  const report = buildRetentionReport(new Date().toISOString());
  expect(report.rules).toHaveLength(6);
  expect(report.overallStatus === 'clean' || report.overallStatus === 'attention_needed').toBe(true);
});

test('buildDemoDataSummary returns positive counts', () => {
  const s = buildDemoDataSummary();
  expect(s.memoriesCount).toBeGreaterThan(0);
  expect(s.totalItemCount).toBeGreaterThan(0);
});

// ─── Section 6: Privacy dashboard engine ─────────────────────────────────────

section('Section 6: Privacy dashboard engine');

test('createDashboardState has 10 consents', () => {
  const state = createDashboardState();
  expect(state.consents).toHaveLength(10);
});

test('createDashboardState has empty audit log', () => {
  const state = createDashboardState();
  expect(state.auditLog).toHaveLength(0);
});

test('createDashboardState has demo data summary', () => {
  const state = createDashboardState();
  expect(state.dataSummary.memoriesCount).toBeGreaterThan(0);
});

test('buildPrivacySummary: grantedCount > 0 for fresh registry', () => {
  const state = createDashboardState();
  const summary = buildPrivacySummary(state.consents, state.auditLog);
  expect(summary.grantedCount).toBeGreaterThan(0);
});

test('buildPrivacySummary: placeholderCount = 2', () => {
  const state = createDashboardState();
  const summary = buildPrivacySummary(state.consents, state.auditLog);
  expect(summary.placeholderCount).toBe(2);
});

test('buildPrivacySummary: lastAuditEvent null for empty log', () => {
  const state = createDashboardState();
  const summary = buildPrivacySummary(state.consents, []);
  expect(summary.lastAuditEvent).toBeNull();
});

test('buildPrivacySummary: overallRisk is one of low/medium/high', () => {
  const state = createDashboardState();
  const summary = buildPrivacySummary(state.consents, state.auditLog);
  expect(['low', 'medium', 'high'].includes(summary.overallRisk)).toBe(true);
});

test('clearMemories zeros memoriesCount', () => {
  const state = createDashboardState();
  const updated = clearMemories(state.dataSummary);
  expect(updated.memoriesCount).toBe(0);
});

test('clearNavigationHistory zeros navigationHistoryCount', () => {
  const state = createDashboardState();
  const updated = clearNavigationHistory(state.dataSummary);
  expect(updated.navigationHistoryCount).toBe(0);
});

test('deleteAllData zeros all counts', () => {
  const state = createDashboardState();
  const updated = deleteAllData(state.dataSummary);
  expect(updated.totalItemCount).toBe(0);
});

test('buildPrivacyExport has PRIVACY_VERSION', () => {
  const state = createDashboardState();
  const exp = buildPrivacyExport(state);
  expect(exp.version).toBe(PRIVACY_VERSION);
});

test('buildPrivacyExport includes privacy note', () => {
  const state = createDashboardState();
  const exp = buildPrivacyExport(state);
  expect(exp.privacyNote).toBe(PRIVACY_DISCLAIMER);
});

test('buildPrivacyExport contains consent list', () => {
  const state = createDashboardState();
  const exp = buildPrivacyExport(state);
  expect(exp.consents).toHaveLength(10);
});

test('exportAsJson produces valid JSON', () => {
  const state = createDashboardState();
  const json = exportAsJson(state);
  const parsed = JSON.parse(json);
  expect(parsed.version).toBe(PRIVACY_VERSION);
});

test('resetPrivacySettings restores default consents', () => {
  const state = createDashboardState();
  const revoked = {
    ...state,
    consents: revokeConsent(state.consents, 'camera'),
  };
  const reset = resetPrivacySettings(revoked);
  const cam = reset.consents.find(c => c.id === 'camera');
  expect(cam?.status).toBe('granted');
});

test('resetPrivacySettings logs privacy_reset event', () => {
  const state = createDashboardState();
  const reset = resetPrivacySettings(state);
  const last = reset.auditLog[reset.auditLog.length - 1];
  expect(last.type).toBe('privacy_reset');
});

test('resetPrivacySettings sets lastReset timestamp', () => {
  const state = createDashboardState();
  const reset = resetPrivacySettings(state);
  expect(reset.lastReset).toBeTruthy();
});

test('riskLabel("low") returns Low Privacy Risk', () => {
  expect(riskLabel('low')).toBe('Low Privacy Risk');
});

test('riskColor("high") returns red class', () => {
  expect(riskColor('high')).toContain('red');
});

// ─── Section 7: Integration ───────────────────────────────────────────────────

section('Section 7: Integration pipeline');

test('full grant → audit → summary pipeline', () => {
  const state = createDashboardState();
  const consents = grantConsent(state.consents, 'microphone', '2026-01-01T00:00:00Z');
  const log = logPermissionGranted(state.auditLog, 'microphone', 'Microphone');
  const summary = buildPrivacySummary(consents, log);
  expect(summary.grantedCount).toBeGreaterThan(state.consents.filter(c => c.status === 'granted').length - 1);
  expect(summary.lastAuditEvent?.type).toBe('permission_granted');
});

test('full revoke → audit → denied query', () => {
  const state = createDashboardState();
  const consents = revokeConsent(state.consents, 'camera');
  const denied = getDeniedConsents(consents);
  expect(denied.length).toBeGreaterThan(0);
  expect(denied[0].id).toBe('camera');
});

test('export after data deletion shows zeroed counts', () => {
  const state = createDashboardState();
  const cleared = deleteAllData(state.dataSummary);
  const stateAfter = { ...state, dataSummary: cleared };
  const exp = buildPrivacyExport(stateAfter);
  expect(exp.dataSummary.totalItemCount).toBe(0);
});

test('reset then audit log contains reset event', () => {
  const state = createDashboardState();
  const reset = resetPrivacySettings(state);
  const events = getEventsByType(reset.auditLog, 'privacy_reset');
  expect(events).toHaveLength(1);
});

test('PRIVACY_DISCLAIMER is non-empty', () => {
  expect(PRIVACY_DISCLAIMER.length).toBeGreaterThan(10);
});

test('audit summary after multiple events has correct counts', () => {
  let log = logPermissionGranted([], 'camera', 'Camera');
  log = logPermissionRevoked(log, 'camera', 'Camera');
  log = logSettingsChanged(log, 'rate', '1.0', '1.5');
  log = logDataExported(log);
  const summary = buildAuditSummary(log);
  expect(summary.totalEvents).toBe(4);
  expect(summary.permissionChanges).toBe(2);
  expect(summary.settingsChanges).toBe(1);
  expect(summary.dataOperations).toBe(1);
});

test('retention report for fresh data is clean', () => {
  const report = buildRetentionReport(new Date().toISOString());
  expect(report.overallStatus).toBe('clean');
});

test('impactColor("high") returns red class', () => {
  expect(impactColor('high')).toContain('red');
});

test('impactColor("none") returns green class', () => {
  expect(impactColor('none')).toContain('green');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

process.stdout.write(`\n${'─'.repeat(60)}\n`);
process.stdout.write(`Sprint 12 Privacy Dashboard Tests\n`);
process.stdout.write(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}\n`);
if (failures.length) {
  process.stdout.write(`\nFailures:\n${failures.join('\n')}\n`);
  process.exit(1);
} else {
  process.stdout.write('All tests passed.\n');
  process.exit(0);
}
