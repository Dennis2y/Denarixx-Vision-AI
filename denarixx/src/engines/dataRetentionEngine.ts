// Sprint 12 — Data Retention Engine (pure functional, no async, no I/O)
// Retention policies, expiry detection, and deletion logic.

import type {
  RetentionPolicy,
  RetentionRule,
  RetentionReport,
  DataCategory,
  DataSummary,
} from '@/types/privacy';

// ─── Retention rules registry ────────────────────────────────────────────────

export const RETENTION_RULES: RetentionRule[] = [
  {
    dataCategory: 'memories',
    policy: '90days',
    autoDelete: false,
    encryptedAtRest: false,
    retentionLabel: 'Kept for 90 days · manual deletion available',
  },
  {
    dataCategory: 'saved_places',
    policy: '90days',
    autoDelete: false,
    encryptedAtRest: false,
    retentionLabel: 'Kept for 90 days · manual deletion available',
  },
  {
    dataCategory: 'navigation_history',
    policy: '30days',
    autoDelete: true,
    encryptedAtRest: false,
    retentionLabel: 'Auto-deleted after 30 days',
  },
  {
    dataCategory: 'ai_activity',
    policy: '7days',
    autoDelete: true,
    encryptedAtRest: false,
    retentionLabel: 'Auto-deleted after 7 days',
  },
  {
    dataCategory: 'preferences',
    policy: 'forever',
    autoDelete: false,
    encryptedAtRest: false,
    retentionLabel: 'Kept until manually reset',
  },
  {
    dataCategory: 'audit_log',
    policy: '30days',
    autoDelete: true,
    encryptedAtRest: false,
    retentionLabel: 'Ring-buffer: last 100 entries · auto-cleared after 30 days',
  },
];

// ─── Policy helpers ───────────────────────────────────────────────────────────

const POLICY_DAYS: Record<RetentionPolicy, number | null> = {
  session: 0,
  '7days': 7,
  '30days': 30,
  '90days': 90,
  forever: null,
};

export function policyToDays(policy: RetentionPolicy): number | null {
  return POLICY_DAYS[policy] ?? null;
}

export function policyLabel(policy: RetentionPolicy): string {
  const labels: Record<RetentionPolicy, string> = {
    session: 'Session only',
    '7days': '7 days',
    '30days': '30 days',
    '90days': '90 days',
    forever: 'Until reset',
  };
  return labels[policy] ?? policy;
}

export function getRetentionRule(category: DataCategory): RetentionRule | undefined {
  return RETENTION_RULES.find(r => r.dataCategory === category);
}

// ─── Expiry detection ─────────────────────────────────────────────────────────

export function isExpired(
  policy: RetentionPolicy,
  createdAt: string,
  nowIso?: string,
): boolean {
  const days = policyToDays(policy);
  if (days === null) return false;
  if (days === 0) return true; // session-only always expired after session
  const created = new Date(createdAt).getTime();
  const now = new Date(nowIso ?? new Date().toISOString()).getTime();
  const maxAge = days * 24 * 60 * 60 * 1000;
  return now - created > maxAge;
}

export function isExpiringSoon(
  policy: RetentionPolicy,
  createdAt: string,
  nowIso?: string,
  warningDays = 2,
): boolean {
  const days = policyToDays(policy);
  if (days === null) return false;
  if (days === 0) return false;
  const created = new Date(createdAt).getTime();
  const now = new Date(nowIso ?? new Date().toISOString()).getTime();
  const maxAge = days * 24 * 60 * 60 * 1000;
  const warningMs = warningDays * 24 * 60 * 60 * 1000;
  const age = now - created;
  return age > maxAge - warningMs && age <= maxAge;
}

export function daysUntilExpiry(
  policy: RetentionPolicy,
  createdAt: string,
  nowIso?: string,
): number | null {
  const days = policyToDays(policy);
  if (days === null) return null;
  if (days === 0) return 0;
  const created = new Date(createdAt).getTime();
  const now = new Date(nowIso ?? new Date().toISOString()).getTime();
  const expiresAt = created + days * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
}

// ─── Deletion logic ───────────────────────────────────────────────────────────

export function canDeleteCategory(category: DataCategory): boolean {
  // Preferences can only be reset, not deleted
  return category !== 'preferences';
}

export function simulateDeletion(
  summary: DataSummary,
  category: DataCategory,
): DataSummary {
  const updated = { ...summary };
  switch (category) {
    case 'memories':
      updated.memoriesCount = 0;
      break;
    case 'saved_places':
      updated.savedPlacesCount = 0;
      break;
    case 'navigation_history':
      updated.navigationHistoryCount = 0;
      break;
    case 'ai_activity':
      updated.aiActivityCount = 0;
      break;
    case 'audit_log':
      break;
    default:
      break;
  }
  updated.totalItemCount =
    updated.memoriesCount +
    updated.savedPlacesCount +
    updated.navigationHistoryCount +
    updated.aiActivityCount;
  return updated;
}

export function simulateDeleteAll(summary: DataSummary): DataSummary {
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

// ─── Retention report ─────────────────────────────────────────────────────────

export function buildRetentionReport(
  createdAt: string,
  nowIso?: string,
): RetentionReport {
  const expired: DataCategory[] = [];
  const expiring: DataCategory[] = [];

  for (const rule of RETENTION_RULES) {
    if (rule.policy === 'forever' || rule.policy === 'session') continue;
    if (isExpired(rule.policy, createdAt, nowIso)) {
      if (rule.autoDelete) expired.push(rule.dataCategory);
    } else if (isExpiringSoon(rule.policy, createdAt, nowIso)) {
      expiring.push(rule.dataCategory);
    }
  }

  return {
    rules: [...RETENTION_RULES],
    expiredCategories: expired,
    expiringCategories: expiring,
    overallStatus: expired.length > 0 ? 'attention_needed' : 'clean',
    generatedAt: nowIso ?? new Date().toISOString(),
  };
}

// ─── Demo data summary ────────────────────────────────────────────────────────

export function buildDemoDataSummary(): DataSummary {
  return {
    memoriesCount: 12,
    savedPlacesCount: 4,
    navigationHistoryCount: 8,
    aiActivityCount: 47,
    retentionStatus: 'healthy',
    oldestDataAge: '14 days',
    totalItemCount: 71,
  };
}
