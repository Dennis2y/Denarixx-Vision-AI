// Sprint 12 — Consent Management Engine (pure functional, no async, no I/O)
// Manages the consent registry, grant/revoke lifecycle, and consent queries.

import type {
  ConsentItem,
  ConsentStatus,
  PrivacyImpact,
} from '@/types/privacy';

// ─── Consent registry ─────────────────────────────────────────────────────────

export const CONSENT_REGISTRY: ConsentItem[] = [
  {
    id: 'camera',
    name: 'Camera',
    description: 'Access the device camera to detect hazards and analyse scenes in real time.',
    reason: 'Required for all visual AI features — hazard detection, object tracking, and scene understanding.',
    privacyImpact: 'high',
    status: 'granted',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: 'session',
    isToggleable: true,
  },
  {
    id: 'microphone',
    name: 'Microphone',
    description: 'Access the device microphone to listen for voice commands.',
    reason: 'Required for hands-free voice command input and ambient noise awareness.',
    privacyImpact: 'high',
    status: 'not_requested',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: 'session',
    isToggleable: true,
  },
  {
    id: 'navigation',
    name: 'Navigation & Location',
    description: 'Use GPS and compass data to provide turn-by-turn navigation guidance.',
    reason: 'Required for outdoor navigation, heading detection, and route memory.',
    privacyImpact: 'medium',
    status: 'not_requested',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: '30days',
    isToggleable: true,
  },
  {
    id: 'long_term_memory',
    name: 'Long-Term Memory',
    description: 'Store routes, familiar places, and learned preferences across sessions.',
    reason: 'Enables the AI to recognise familiar environments and provide personalised guidance.',
    privacyImpact: 'medium',
    status: 'not_requested',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: '90days',
    isToggleable: true,
  },
  {
    id: 'voice_companion',
    name: 'Voice Companion',
    description: 'Enable the AI companion to speak guidance, alerts, and conversational responses.',
    reason: 'Core audio output channel — required for all speech guidance.',
    privacyImpact: 'low',
    status: 'granted',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: 'session',
    isToggleable: true,
  },
  {
    id: 'scene_descriptions',
    name: 'Scene Descriptions',
    description: 'Generate detailed descriptions of the current environment.',
    reason: 'Provides spatial context, landmark identification, and environmental awareness.',
    privacyImpact: 'low',
    status: 'granted',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: 'session',
    isToggleable: true,
  },
  {
    id: 'ai_explanations',
    name: 'AI Explanations',
    description: 'Show why the AI made each decision, with confidence scores and reasoning.',
    reason: 'Required for the Explainable AI & Trust system — transparency for every alert.',
    privacyImpact: 'none',
    status: 'granted',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: 'session',
    isToggleable: true,
  },
  {
    id: 'analytics',
    name: 'Session Analytics',
    description: 'Anonymised session statistics used to improve AI accuracy (simulation only).',
    reason: 'Helps improve hazard detection without storing personal data.',
    privacyImpact: 'low',
    status: 'granted',
    isPlaceholder: false,
    lastAccessed: null,
    retentionPolicy: '7days',
    isToggleable: true,
  },
  {
    id: 'cloud_sync',
    name: 'Future Cloud Sync',
    description: 'Securely back up preferences and memories to an encrypted cloud service.',
    reason: 'Future feature: cross-device sync with end-to-end encryption.',
    privacyImpact: 'high',
    status: 'placeholder',
    isPlaceholder: true,
    lastAccessed: null,
    retentionPolicy: 'forever',
    isToggleable: false,
  },
  {
    id: 'face_recognition',
    name: 'Face Recognition',
    description: 'Recognise designated people (family, caregivers) with your explicit consent.',
    reason: 'Future feature: opt-in identification of trusted persons only.',
    privacyImpact: 'high',
    status: 'placeholder',
    isPlaceholder: true,
    lastAccessed: null,
    retentionPolicy: 'forever',
    isToggleable: false,
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getConsent(consents: ConsentItem[], id: string): ConsentItem | undefined {
  return consents.find(c => c.id === id);
}

export function getAllConsents(consents: ConsentItem[]): ConsentItem[] {
  return [...consents];
}

export function getToggleableConsents(consents: ConsentItem[]): ConsentItem[] {
  return consents.filter(c => c.isToggleable && !c.isPlaceholder);
}

export function getPlaceholderConsents(consents: ConsentItem[]): ConsentItem[] {
  return consents.filter(c => c.isPlaceholder);
}

// ─── Status queries ───────────────────────────────────────────────────────────

export function hasConsentFor(consents: ConsentItem[], id: string): boolean {
  const item = getConsent(consents, id);
  return item?.status === 'granted';
}

export function getConsentStatus(consents: ConsentItem[], id: string): ConsentStatus {
  return getConsent(consents, id)?.status ?? 'not_requested';
}

export function getGrantedConsents(consents: ConsentItem[]): ConsentItem[] {
  return consents.filter(c => c.status === 'granted');
}

export function getDeniedConsents(consents: ConsentItem[]): ConsentItem[] {
  return consents.filter(c => c.status === 'denied');
}

export function getHighImpactGranted(consents: ConsentItem[]): ConsentItem[] {
  return consents.filter(c => c.status === 'granted' && c.privacyImpact === 'high');
}

// ─── Grant / revoke ───────────────────────────────────────────────────────────

export function grantConsent(
  consents: ConsentItem[],
  id: string,
  timestamp: string,
): ConsentItem[] {
  return consents.map(c =>
    c.id === id && c.isToggleable && !c.isPlaceholder
      ? { ...c, status: 'granted', lastAccessed: timestamp }
      : c,
  );
}

export function revokeConsent(
  consents: ConsentItem[],
  id: string,
): ConsentItem[] {
  return consents.map(c =>
    c.id === id && c.isToggleable && !c.isPlaceholder
      ? { ...c, status: 'denied' }
      : c,
  );
}

export function toggleConsent(
  consents: ConsentItem[],
  id: string,
  timestamp: string,
): ConsentItem[] {
  const current = getConsentStatus(consents, id);
  return current === 'granted'
    ? revokeConsent(consents, id)
    : grantConsent(consents, id, timestamp);
}

export function resetAllConsents(baseRegistry: ConsentItem[]): ConsentItem[] {
  return baseRegistry.map(c => ({ ...c }));
}

// ─── Impact helpers ───────────────────────────────────────────────────────────

export function impactLabel(impact: PrivacyImpact): string {
  const labels: Record<PrivacyImpact, string> = {
    none: 'No data stored',
    low: 'Minimal impact',
    medium: 'Moderate impact',
    high: 'High impact',
  };
  return labels[impact];
}

export function impactColor(impact: PrivacyImpact): string {
  const colors: Record<PrivacyImpact, string> = {
    none: 'text-green-400',
    low: 'text-yellow-400',
    medium: 'text-orange-400',
    high: 'text-red-400',
  };
  return colors[impact];
}

export function statusLabel(status: ConsentStatus): string {
  const labels: Record<ConsentStatus, string> = {
    granted: 'Enabled',
    denied: 'Disabled',
    not_requested: 'Not requested',
    placeholder: 'Coming soon',
  };
  return labels[status];
}
