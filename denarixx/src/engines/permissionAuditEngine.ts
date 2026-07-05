// Sprint 12 — Permission Audit Engine (pure functional, no async, no I/O)
// Ring-buffer audit log for all privacy-relevant events.

import type { AuditEvent, AuditEventType } from '@/types/privacy';
import { AUDIT_RING_BUFFER_SIZE } from '@/types/privacy';

// ─── Event creation ───────────────────────────────────────────────────────────

let _nextId = 1;

export function createAuditEvent(
  type: AuditEventType,
  description: string,
  metadata: Record<string, string> = {},
  timestamp?: string,
): AuditEvent {
  return {
    id: `audit_${_nextId++}`,
    type,
    timestamp: timestamp ?? new Date().toISOString(),
    description,
    metadata,
  };
}

/** Reset the ID counter — only for tests */
export function _resetAuditIdCounter(): void {
  _nextId = 1;
}

// ─── Ring-buffer append ───────────────────────────────────────────────────────

export function appendAuditEvent(
  log: AuditEvent[],
  event: AuditEvent,
): AuditEvent[] {
  const updated = [...log, event];
  if (updated.length > AUDIT_RING_BUFFER_SIZE) {
    return updated.slice(updated.length - AUDIT_RING_BUFFER_SIZE);
  }
  return updated;
}

export function logPermissionGranted(
  log: AuditEvent[],
  consentId: string,
  consentName: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent(
      'permission_granted',
      `Permission granted: ${consentName}`,
      { consentId },
      timestamp,
    ),
  );
}

export function logPermissionRevoked(
  log: AuditEvent[],
  consentId: string,
  consentName: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent(
      'permission_revoked',
      `Permission revoked: ${consentName}`,
      { consentId },
      timestamp,
    ),
  );
}

export function logMemoryCreated(
  log: AuditEvent[],
  memoryId: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('memory_created', `Memory entry created`, { memoryId }, timestamp),
  );
}

export function logMemoryDeleted(
  log: AuditEvent[],
  memoryId: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('memory_deleted', `Memory entry deleted`, { memoryId }, timestamp),
  );
}

export function logSettingsChanged(
  log: AuditEvent[],
  setting: string,
  oldValue: string,
  newValue: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent(
      'settings_changed',
      `Setting changed: ${setting}`,
      { setting, oldValue, newValue },
      timestamp,
    ),
  );
}

export function logNavigationExported(
  log: AuditEvent[],
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('navigation_exported', 'Navigation history exported', {}, timestamp),
  );
}

export function logPrivacyReset(
  log: AuditEvent[],
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('privacy_reset', 'Privacy settings reset to defaults', {}, timestamp),
  );
}

export function logDataExported(
  log: AuditEvent[],
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('data_exported', 'Full privacy data export created', {}, timestamp),
  );
}

export function logDataDeleted(
  log: AuditEvent[],
  category: string,
  timestamp?: string,
): AuditEvent[] {
  return appendAuditEvent(
    log,
    createAuditEvent('data_deleted', `Data deleted: ${category}`, { category }, timestamp),
  );
}

export function logAuditCleared(timestamp?: string): AuditEvent[] {
  return [
    createAuditEvent('audit_cleared', 'Audit log cleared by user', {}, timestamp),
  ];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getRecentEvents(log: AuditEvent[], count: number): AuditEvent[] {
  return [...log].reverse().slice(0, count);
}

export function getEventsByType(log: AuditEvent[], type: AuditEventType): AuditEvent[] {
  return log.filter(e => e.type === type);
}

export function getLastEvent(log: AuditEvent[]): AuditEvent | null {
  return log.length > 0 ? log[log.length - 1] : null;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface AuditSummary {
  totalEvents: number;
  permissionChanges: number;
  dataOperations: number;
  settingsChanges: number;
  lastEventAt: string | null;
}

export function buildAuditSummary(log: AuditEvent[]): AuditSummary {
  return {
    totalEvents: log.length,
    permissionChanges: log.filter(e =>
      e.type === 'permission_granted' || e.type === 'permission_revoked',
    ).length,
    dataOperations: log.filter(e =>
      e.type === 'data_exported' || e.type === 'data_deleted' ||
      e.type === 'memory_created' || e.type === 'memory_deleted',
    ).length,
    settingsChanges: log.filter(e => e.type === 'settings_changed').length,
    lastEventAt: log.length > 0 ? log[log.length - 1].timestamp : null,
  };
}

// ─── Audit event label ────────────────────────────────────────────────────────

export function auditEventIcon(type: AuditEventType): string {
  const icons: Record<AuditEventType, string> = {
    permission_granted: '✅',
    permission_revoked: '🚫',
    memory_created: '🧠',
    memory_deleted: '🗑',
    settings_changed: '⚙️',
    navigation_exported: '🗺',
    privacy_reset: '🔄',
    data_exported: '📤',
    data_deleted: '🗑',
    audit_cleared: '🧹',
  };
  return icons[type] ?? '📋';
}
