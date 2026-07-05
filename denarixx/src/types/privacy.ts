// Sprint 12 — Privacy Dashboard & Consent Management — type definitions
// Separate from all other type files. Never merge into index.ts or preferences.ts.

// ─── Core enumerations ────────────────────────────────────────────────────────

export type ConsentStatus = 'granted' | 'denied' | 'not_requested' | 'placeholder';

export type PrivacyImpact = 'none' | 'low' | 'medium' | 'high';

export type RetentionPolicy = 'session' | '7days' | '30days' | '90days' | 'forever';

export type AuditEventType =
  | 'permission_granted'
  | 'permission_revoked'
  | 'memory_created'
  | 'memory_deleted'
  | 'settings_changed'
  | 'navigation_exported'
  | 'privacy_reset'
  | 'data_exported'
  | 'data_deleted'
  | 'audit_cleared';

export type DataCategory =
  | 'memories'
  | 'saved_places'
  | 'navigation_history'
  | 'ai_activity'
  | 'preferences'
  | 'audit_log';

// ─── Consent item ─────────────────────────────────────────────────────────────

export interface ConsentItem {
  id: string;
  name: string;
  description: string;
  /** Why Denarixx needs this permission */
  reason: string;
  privacyImpact: PrivacyImpact;
  status: ConsentStatus;
  /** True = not yet implemented, shown as roadmap item */
  isPlaceholder: boolean;
  /** ISO timestamp or null if never accessed */
  lastAccessed: string | null;
  retentionPolicy: RetentionPolicy;
  /** Can user toggle this consent? */
  isToggleable: boolean;
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  description: string;
  metadata: Record<string, string>;
}

// ─── Data summary ─────────────────────────────────────────────────────────────

export interface DataSummary {
  memoriesCount: number;
  savedPlacesCount: number;
  navigationHistoryCount: number;
  aiActivityCount: number;
  retentionStatus: 'healthy' | 'expiring_soon' | 'overdue';
  oldestDataAge: string | null;
  totalItemCount: number;
}

// ─── Retention rule ───────────────────────────────────────────────────────────

export interface RetentionRule {
  dataCategory: DataCategory;
  policy: RetentionPolicy;
  autoDelete: boolean;
  /** Future placeholder: server-side encryption */
  encryptedAtRest: boolean;
  /** Human-readable retention period */
  retentionLabel: string;
}

export interface RetentionReport {
  rules: RetentionRule[];
  expiredCategories: DataCategory[];
  expiringCategories: DataCategory[];
  overallStatus: 'clean' | 'attention_needed';
  generatedAt: string;
}

// ─── Privacy dashboard state ──────────────────────────────────────────────────

export interface PrivacyDashboardState {
  consents: ConsentItem[];
  auditLog: AuditEvent[];
  dataSummary: DataSummary;
  retentionReport: RetentionReport;
  lastReset: string | null;
  exportAvailable: boolean;
}

// ─── Data export ──────────────────────────────────────────────────────────────

export interface PrivacyExport {
  exportedAt: string;
  version: number;
  consents: ConsentItem[];
  auditLogSample: AuditEvent[];
  dataSummary: DataSummary;
  privacyNote: string;
  disclaimer: string;
}

// ─── Privacy summary (for dashboard header) ───────────────────────────────────

export interface PrivacySummary {
  grantedCount: number;
  deniedCount: number;
  placeholderCount: number;
  highImpactGranted: number;
  overallRisk: 'low' | 'medium' | 'high';
  lastAuditEvent: AuditEvent | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRIVACY_VERSION = 1;
export const AUDIT_RING_BUFFER_SIZE = 100;

export const PRIVACY_DISCLAIMER =
  'Denarixx Vision AI is a simulation MVP. No data leaves your device. ' +
  'All storage is in-memory and resets on page reload. ' +
  'Cloud sync and encryption are planned for a future release.';

export const PRIVACY_PHILOSOPHY =
  'Denarixx is designed privacy-first. Every feature that collects data ' +
  'requires explicit consent. You can revoke any permission and delete any data at any time.';

export const GDPR_NOTE =
  'Future cloud features will be built to meet GDPR Article 7 (consent), ' +
  'Article 17 (right to erasure), and Article 20 (data portability) requirements.';
