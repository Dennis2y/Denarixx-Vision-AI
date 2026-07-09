// ─── Sprint 15: Street Safety Types ──────────────────────────────────────────
// No-Internet Street Safety Mode for Denarixx Vision Glasses.
// Glasses compute module is primary. Phone is fallback. Cloud is optional.

// ─── Hazard Classification ────────────────────────────────────────────────────

export type StreetHazardType =
  | 'obstacle'
  | 'stairs'
  | 'vehicle'
  | 'crossing'
  | 'person-approaching'
  | 'bicycle-scooter'
  | 'stop'
  | 'slow-down'
  | 'move-left'
  | 'move-right'
  | 'camera-failure'
  | 'unknown';

export type HazardSeverity = 'critical' | 'high' | 'medium' | 'low';

export type HazardDirection = 'ahead' | 'left' | 'right' | 'behind' | 'unknown';

export type GuardianDecision = 'speak' | 'silent';

// ─── Connectivity & Mode ──────────────────────────────────────────────────────

export type StreetSafetyMode = 'online' | 'offline' | 'degraded';

export type ConnectivityState =
  | 'connected'
  | 'disconnected'
  | 'weak'
  | 'checking';

// ─── Hazard Pattern (local glasses compute) ───────────────────────────────────

export interface LocalHazardPattern {
  hazardType: StreetHazardType;
  severity: HazardSeverity;
  confidence: number;
  direction: HazardDirection;
  detectionCount: number;
  firstSeenTick: number;
  lastSeenTick: number;
  isCriticalBypass: boolean;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface HazardAlert {
  id: string;
  hazardType: StreetHazardType;
  severity: HazardSeverity;
  direction: HazardDirection;
  guidance: string;
  spokenMessage: string;
  confidence: number;
  isOffline: boolean;
  tick: number;
}

// ─── Guardian Decision ────────────────────────────────────────────────────────

export interface OfflineGuardianDecision {
  decision: GuardianDecision;
  hazard: LocalHazardPattern;
  alert: HazardAlert | null;
  reason: string;
  bypassedThrottle: boolean;
}

// ─── Connectivity Fallback ────────────────────────────────────────────────────

export interface ConnectivityFallbackConfig {
  mode: StreetSafetyMode;
  connectivityState: ConnectivityState;
  offlineSince: number | null;
  lastCloudCallAt: number | null;
  fallbackActive: boolean;
  cloudEnhancementAvailable: boolean;
  announcementPending: string | null;
}

// ─── Pattern Library Entry ────────────────────────────────────────────────────

export interface PatternLibraryEntry {
  hazardType: StreetHazardType;
  keywords: string[];
  defaultSeverity: HazardSeverity;
  offlineGuidance: string;
  onlineGuidance: string;
  spokenPrefix: string;
  criticalConfidenceThreshold: number;
  neverSafeToPass: boolean;
}

// ─── Full Street Safety State ─────────────────────────────────────────────────

export interface StreetSafetyState {
  mode: StreetSafetyMode;
  connectivity: ConnectivityFallbackConfig;
  activeHazards: LocalHazardPattern[];
  recentAlerts: HazardAlert[];
  cameraHealthy: boolean;
  sessionTick: number;
  guardianActive: boolean;
  totalAlertsSpoken: number;
  offlineDurationSeconds: number;
}

// ─── Summary (for UI) ─────────────────────────────────────────────────────────

export interface StreetSafetySummary {
  mode: StreetSafetyMode;
  isOffline: boolean;
  cameraHealthy: boolean;
  activeHazardCount: number;
  criticalHazardCount: number;
  recentAlertCount: number;
  offlineDurationSeconds: number;
  connectivityState: ConnectivityState;
  topHazard: LocalHazardPattern | null;
  guardianActive: boolean;
}

// ─── Transition Message ───────────────────────────────────────────────────────

export interface ConnectivityTransition {
  from: ConnectivityState;
  to: ConnectivityState;
  modeChange: StreetSafetyMode;
  spokenAnnouncement: string;
  displayMessage: string;
  timestamp: number;
}

// ─── Safety Constants ─────────────────────────────────────────────────────────

export const CROSSING_SAFETY_MESSAGE =
  'The path appears clear, but please check carefully before crossing.';

export const CAMERA_FAILURE_MESSAGE =
  'Warning: Glasses camera is not available. Please stop, use caution, and seek assistance.';

export const OFFLINE_MODE_ANNOUNCEMENT =
  'Internet is unavailable. Offline street safety mode is active.';

export const ONLINE_RESTORED_ANNOUNCEMENT =
  'Online enhancement restored. Safety mode remains active.';

export const STREET_SAFETY_DISCLAIMER =
  'Denarixx street safety is assistive only. Never replace your own judgement or a human guide.';

export const NEVER_SAFE_TO_CROSS_RULE =
  'The Guardian must never state it is safe to cross. Always require the user to verify independently.';

export const GLASSES_PRIMARY_NOTE =
  'All street safety functions run on the glasses compute module. ' +
  'Phone and cloud are optional enhancements — never dependencies for safety.';
