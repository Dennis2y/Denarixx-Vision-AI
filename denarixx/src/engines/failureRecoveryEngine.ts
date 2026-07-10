/**
 * Failure Recovery Engine — Live Perception Hardening
 *
 * Defines the 12 failure scenarios that can occur in the live perception pipeline.
 * Each scenario has:
 *   - type identifier
 *   - detection criteria
 *   - human-friendly user announcement (no jargon)
 *   - recovery level (continue / degrade / minimal / stop)
 *   - fallback action
 *
 * SAFETY GUARANTEE: Core offline safety (hazard detection) MUST continue at all
 * levels except 'stop'. The system may degrade gracefully but never fails silently.
 *
 * Pure TypeScript — no browser APIs, fully testable in Node.js.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FailureType =
  | 'camera-permission-denied'
  | 'camera-disconnected'
  | 'model-load-failure'
  | 'cloud-provider-timeout'
  | 'no-internet'
  | 'weak-internet'
  | 'ocr-worker-crash'
  | 'stt-unavailable'
  | 'tts-unavailable'
  | 'location-unavailable'
  | 'battery-critical'
  | 'overheating';

export type RecoveryLevel =
  | 'continue'  // full operation resumes or alternative provides same coverage
  | 'degrade'   // reduced functionality, core safety intact
  | 'minimal'   // only critical safety; most features suspended
  | 'stop';     // safe shutdown required (user-initiated emergency stop)

export type FallbackAction =
  | 'use-simulation'
  | 'use-offline-safety'
  | 'use-haptic-only'
  | 'use-local-ai'
  | 'reduce-frequency'
  | 'disable-feature'
  | 'restart-feature'
  | 'user-must-act';

export interface FailureScenario {
  type: FailureType;
  /** Short label for logging / diagnostics */
  label: string;
  /** Human-friendly announcement spoken to the user */
  announcement: string;
  /** How severe the degradation is */
  recoveryLevel: RecoveryLevel;
  /** What the system does automatically */
  fallbackAction: FallbackAction;
  /** Whether the safety core (guardian + offline hazard detection) remains active */
  safetyCoreMaintained: boolean;
  /** Whether the user needs to take an action */
  requiresUserAction: boolean;
  /** Hint spoken after announcement when user action is needed */
  userActionHint?: string;
}

// ── Failure registry ──────────────────────────────────────────────────────────

export const FAILURE_REGISTRY: Record<FailureType, FailureScenario> = {
  'camera-permission-denied': {
    type: 'camera-permission-denied',
    label: 'Camera permission denied',
    announcement:
      'Camera access was denied. I will scan your surroundings without a camera.',
    recoveryLevel: 'degrade',
    fallbackAction: 'use-simulation',
    safetyCoreMaintained: true,
    requiresUserAction: true,
    userActionHint:
      'To enable the camera, open your device settings and allow camera access for this app.',
  },

  'camera-disconnected': {
    type: 'camera-disconnected',
    label: 'Camera disconnected',
    announcement:
      'Camera connection lost. Offline safety mode is now active.',
    recoveryLevel: 'degrade',
    fallbackAction: 'use-offline-safety',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'model-load-failure': {
    type: 'model-load-failure',
    label: 'On-device AI model failed to load',
    announcement:
      "On-device vision couldn't start. Using basic hazard detection instead.",
    recoveryLevel: 'degrade',
    fallbackAction: 'use-simulation',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'cloud-provider-timeout': {
    type: 'cloud-provider-timeout',
    label: 'Cloud vision provider timed out',
    announcement:
      'Online vision is not responding. Offline safety mode is now active.',
    recoveryLevel: 'degrade',
    fallbackAction: 'use-offline-safety',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'no-internet': {
    type: 'no-internet',
    label: 'No internet connection',
    announcement:
      'No internet connection. Offline safety mode is active. Hazard detection continues.',
    recoveryLevel: 'degrade',
    fallbackAction: 'use-offline-safety',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'weak-internet': {
    type: 'weak-internet',
    label: 'Weak internet connection',
    announcement:
      'Internet connection is weak. Reducing cloud features to save power.',
    recoveryLevel: 'degrade',
    fallbackAction: 'reduce-frequency',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'ocr-worker-crash': {
    type: 'ocr-worker-crash',
    label: 'OCR worker crashed',
    announcement:
      'Text reading is temporarily unavailable. Vision and hazard alerts continue.',
    recoveryLevel: 'degrade',
    fallbackAction: 'restart-feature',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'stt-unavailable': {
    type: 'stt-unavailable',
    label: 'Speech recognition unavailable',
    announcement:
      'Voice commands are not available on this device. Use the on-screen controls.',
    recoveryLevel: 'degrade',
    fallbackAction: 'disable-feature',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'tts-unavailable': {
    type: 'tts-unavailable',
    label: 'Text-to-speech unavailable',
    announcement:
      'Audio alerts are not available. Haptic alerts remain active.',
    recoveryLevel: 'degrade',
    fallbackAction: 'use-haptic-only',
    safetyCoreMaintained: true,
    requiresUserAction: true,
    userActionHint:
      'If you are not receiving haptic alerts, please check your vibration settings.',
  },

  'location-unavailable': {
    type: 'location-unavailable',
    label: 'GPS location unavailable',
    announcement:
      'Location services are unavailable. Navigation continues without GPS.',
    recoveryLevel: 'degrade',
    fallbackAction: 'disable-feature',
    safetyCoreMaintained: true,
    requiresUserAction: false,
  },

  'battery-critical': {
    type: 'battery-critical',
    label: 'Battery critically low',
    announcement:
      'Battery is very low. Switching to minimal mode. Core hazard detection stays active.',
    recoveryLevel: 'minimal',
    fallbackAction: 'reduce-frequency',
    safetyCoreMaintained: true,
    requiresUserAction: true,
    userActionHint: 'Please connect to a charger as soon as it is safe to do so.',
  },

  'overheating': {
    type: 'overheating',
    label: 'Device overheating',
    announcement:
      'Device is overheating. Reducing processing to stay safe. Hazard detection continues.',
    recoveryLevel: 'minimal',
    fallbackAction: 'reduce-frequency',
    safetyCoreMaintained: true,
    requiresUserAction: true,
    userActionHint: 'Please find a cooler environment or rest the device for a moment.',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getFailureScenario(type: FailureType): FailureScenario {
  return FAILURE_REGISTRY[type];
}

export function getAllFailureTypes(): FailureType[] {
  return Object.keys(FAILURE_REGISTRY) as FailureType[];
}

/** Returns the announcement text for the failure (always human-friendly) */
export function getFailureAnnouncement(type: FailureType): string {
  return FAILURE_REGISTRY[type].announcement;
}

/** Returns recovery level for a failure type */
export function getRecoveryLevel(type: FailureType): RecoveryLevel {
  return FAILURE_REGISTRY[type].recoveryLevel;
}

/** True if core offline safety is maintained (always true in current registry) */
export function isSafetyCoreActive(type: FailureType): boolean {
  return FAILURE_REGISTRY[type].safetyCoreMaintained;
}

/** True if the user needs to take action to recover */
export function requiresUserAction(type: FailureType): boolean {
  return FAILURE_REGISTRY[type].requiresUserAction;
}

/** Returns the user action hint, or null if no action needed */
export function getUserActionHint(type: FailureType): string | null {
  return FAILURE_REGISTRY[type].userActionHint ?? null;
}

// ── Failure detection helpers ─────────────────────────────────────────────────

export interface FailureDetectionInput {
  cameraPermissionDenied?: boolean;
  cameraDisconnected?: boolean;
  modelLoadFailed?: boolean;
  cloudTimedOut?: boolean;
  isOnline?: boolean;
  bandwidthKbps?: number;
  ocrWorkerCrashed?: boolean;
  speechRecognitionAvailable?: boolean;
  ttsAvailable?: boolean;
  locationAvailable?: boolean;
  batteryLevel?: number;
  isOverheating?: boolean;
}

/**
 * Detect which failure scenarios are active from a system state snapshot.
 * Returns the list of active failure types ordered by severity.
 */
export function detectActiveFailures(input: FailureDetectionInput): FailureType[] {
  const active: FailureType[] = [];

  if (input.cameraPermissionDenied) active.push('camera-permission-denied');
  if (input.cameraDisconnected)     active.push('camera-disconnected');
  if (input.modelLoadFailed)        active.push('model-load-failure');
  if (input.cloudTimedOut)          active.push('cloud-provider-timeout');
  if (input.isOnline === false) {
    active.push('no-internet');
  } else if (input.bandwidthKbps !== undefined && input.bandwidthKbps < 500) {
    active.push('weak-internet');
  }
  if (input.ocrWorkerCrashed)                    active.push('ocr-worker-crash');
  if (input.speechRecognitionAvailable === false) active.push('stt-unavailable');
  if (input.ttsAvailable === false)               active.push('tts-unavailable');
  if (input.locationAvailable === false)          active.push('location-unavailable');

  if (input.batteryLevel !== undefined && input.batteryLevel <= 0.05) {
    active.push('battery-critical');
  }
  if (input.isOverheating) active.push('overheating');

  return active;
}

/**
 * Compute the aggregate recovery level from multiple active failures.
 * Returns the most severe level.
 */
export function aggregateRecoveryLevel(types: FailureType[]): RecoveryLevel {
  const LEVEL_ORDER: Record<RecoveryLevel, number> = {
    continue: 0,
    degrade: 1,
    minimal: 2,
    stop: 3,
  };
  let level: RecoveryLevel = 'continue';
  for (const t of types) {
    const candidate = FAILURE_REGISTRY[t].recoveryLevel;
    if (LEVEL_ORDER[candidate] > LEVEL_ORDER[level]) level = candidate;
  }
  return level;
}

/**
 * True if any active failure reduces the system to minimal or stop level.
 */
export function isMinimalMode(types: FailureType[]): boolean {
  const level = aggregateRecoveryLevel(types);
  return level === 'minimal' || level === 'stop';
}

/**
 * Build a combined summary message for multiple simultaneous failures.
 * Used when multiple failures occur at session start.
 */
export function buildMultiFailureSummary(types: FailureType[]): string {
  if (types.length === 0) return '';
  if (types.length === 1) return FAILURE_REGISTRY[types[0]].announcement;
  const level = aggregateRecoveryLevel(types);
  const safetyNote = 'Core hazard detection remains active.';
  if (level === 'minimal') {
    return `Several features are unavailable. Running in minimal safety mode. ${safetyNote}`;
  }
  return `Some features are unavailable. ${safetyNote}`;
}
