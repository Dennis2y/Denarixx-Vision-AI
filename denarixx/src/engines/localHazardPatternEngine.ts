// ─── Sprint 15: Local Hazard Pattern Engine ───────────────────────────────────
// Pure functions — no async, no I/O.
// Local pattern library stored on glasses compute module.
// Provides hazard guidance without any internet dependency.

import type {
  StreetHazardType,
  HazardSeverity,
  HazardDirection,
  LocalHazardPattern,
  PatternLibraryEntry,
} from '@/types/streetSafety';
import { CROSSING_SAFETY_MESSAGE, CAMERA_FAILURE_MESSAGE } from '@/types/streetSafety';

// ─── Pattern Library (on-glasses) ─────────────────────────────────────────────

export const HAZARD_PATTERN_LIBRARY: PatternLibraryEntry[] = [
  {
    hazardType: 'obstacle',
    keywords: ['object', 'block', 'barrier', 'box', 'bin', 'post', 'wall', 'pillar'],
    defaultSeverity: 'high',
    offlineGuidance: 'Obstacle detected ahead. Please stop or move around it carefully.',
    onlineGuidance: 'Obstacle detected. Cloud analysis provides more detail.',
    spokenPrefix: 'Caution:',
    criticalConfidenceThreshold: 0.85,
    neverSafeToPass: false,
  },
  {
    hazardType: 'stairs',
    keywords: ['step', 'stair', 'stairs', 'steps', 'ramp', 'drop', 'level-change'],
    defaultSeverity: 'critical',
    offlineGuidance: 'Stairs ahead. Please stop and locate the handrail before proceeding.',
    onlineGuidance: 'Stairs detected. Cloud analysis provides direction and count.',
    spokenPrefix: 'Warning:',
    criticalConfidenceThreshold: 0.6,
    neverSafeToPass: false,
  },
  {
    hazardType: 'vehicle',
    keywords: ['car', 'truck', 'bus', 'vehicle', 'van', 'motorcycle', 'traffic'],
    defaultSeverity: 'critical',
    offlineGuidance: 'Vehicle nearby. Please stop immediately and wait.',
    onlineGuidance: 'Vehicle detected. Cloud provides speed and trajectory estimate.',
    spokenPrefix: 'Warning:',
    criticalConfidenceThreshold: 0.5,
    neverSafeToPass: false,
  },
  {
    hazardType: 'crossing',
    keywords: ['crossing', 'crosswalk', 'road', 'street', 'zebra', 'junction', 'intersection'],
    defaultSeverity: 'high',
    offlineGuidance: CROSSING_SAFETY_MESSAGE,
    onlineGuidance: CROSSING_SAFETY_MESSAGE,
    spokenPrefix: 'Crossing ahead:',
    criticalConfidenceThreshold: 0.75,
    neverSafeToPass: true,
  },
  {
    hazardType: 'person-approaching',
    keywords: ['person', 'pedestrian', 'human', 'people', 'man', 'woman', 'child', 'figure'],
    defaultSeverity: 'medium',
    offlineGuidance: 'Person approaching. They may be on a collision path — please move slightly aside.',
    onlineGuidance: 'Person detected. Cloud analysis estimates speed and direction.',
    spokenPrefix: 'Notice:',
    criticalConfidenceThreshold: 0.9,
    neverSafeToPass: false,
  },
  {
    hazardType: 'bicycle-scooter',
    keywords: ['bike', 'bicycle', 'scooter', 'cyclist', 'e-bike', 'e-scooter', 'rider'],
    defaultSeverity: 'high',
    offlineGuidance: 'Bicycle or scooter detected. Please step to the side and wait.',
    onlineGuidance: 'Bicycle or scooter detected. Cloud estimates approach speed.',
    spokenPrefix: 'Caution:',
    criticalConfidenceThreshold: 0.7,
    neverSafeToPass: false,
  },
  {
    hazardType: 'stop',
    keywords: ['stop', 'halt', 'freeze', 'danger', 'immediate'],
    defaultSeverity: 'critical',
    offlineGuidance: 'Stop immediately.',
    onlineGuidance: 'Stop immediately.',
    spokenPrefix: 'Stop:',
    criticalConfidenceThreshold: 0.4,
    neverSafeToPass: false,
  },
  {
    hazardType: 'slow-down',
    keywords: ['slow', 'careful', 'proceed-slowly', 'caution-ahead'],
    defaultSeverity: 'medium',
    offlineGuidance: 'Please slow down. Hazard ahead.',
    onlineGuidance: 'Please slow down. Cloud is analysing the scene.',
    spokenPrefix: 'Slow down:',
    criticalConfidenceThreshold: 0.8,
    neverSafeToPass: false,
  },
  {
    hazardType: 'move-left',
    keywords: ['move-left', 'step-left', 'shift-left', 'keep-left'],
    defaultSeverity: 'medium',
    offlineGuidance: 'Move to the left to avoid the hazard.',
    onlineGuidance: 'Move to the left. Cloud provides clearance estimate.',
    spokenPrefix: 'Move left:',
    criticalConfidenceThreshold: 0.85,
    neverSafeToPass: false,
  },
  {
    hazardType: 'move-right',
    keywords: ['move-right', 'step-right', 'shift-right', 'keep-right'],
    defaultSeverity: 'medium',
    offlineGuidance: 'Move to the right to avoid the hazard.',
    onlineGuidance: 'Move to the right. Cloud provides clearance estimate.',
    spokenPrefix: 'Move right:',
    criticalConfidenceThreshold: 0.85,
    neverSafeToPass: false,
  },
  {
    hazardType: 'camera-failure',
    keywords: ['camera-error', 'camera-off', 'vision-lost', 'no-feed'],
    defaultSeverity: 'critical',
    offlineGuidance: CAMERA_FAILURE_MESSAGE,
    onlineGuidance: CAMERA_FAILURE_MESSAGE,
    spokenPrefix: 'Camera alert:',
    criticalConfidenceThreshold: 0.0,
    neverSafeToPass: false,
  },
  {
    hazardType: 'unknown',
    keywords: [],
    defaultSeverity: 'medium',
    offlineGuidance: 'Unknown hazard detected. Please stop and proceed with caution.',
    onlineGuidance: 'Unknown hazard. Cloud analysis in progress.',
    spokenPrefix: 'Caution:',
    criticalConfidenceThreshold: 0.9,
    neverSafeToPass: false,
  },
];

// ─── Pattern Lookup ───────────────────────────────────────────────────────────

export function getPatternForHazard(type: StreetHazardType): PatternLibraryEntry {
  return (
    HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === type) ??
    HAZARD_PATTERN_LIBRARY[HAZARD_PATTERN_LIBRARY.length - 1]
  );
}

export function matchHazardFromKeywords(keywords: string[]): StreetHazardType {
  const lower = keywords.map(k => k.toLowerCase());
  for (const pattern of HAZARD_PATTERN_LIBRARY) {
    if (pattern.hazardType === 'unknown') continue;
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      return pattern.hazardType;
    }
  }
  return 'unknown';
}

export function getAllCriticalPatterns(): PatternLibraryEntry[] {
  return HAZARD_PATTERN_LIBRARY.filter(
    p => p.defaultSeverity === 'critical' || p.criticalConfidenceThreshold <= 0.5
  );
}

// ─── Hazard Construction ──────────────────────────────────────────────────────

export function estimateHazardSeverity(
  type: StreetHazardType,
  confidence: number
): HazardSeverity {
  const pattern = getPatternForHazard(type);
  if (confidence >= pattern.criticalConfidenceThreshold) return 'critical';
  return pattern.defaultSeverity;
}

export function buildLocalHazardPattern(
  type: StreetHazardType,
  direction: HazardDirection,
  confidence: number,
  tick: number
): LocalHazardPattern {
  const severity = estimateHazardSeverity(type, confidence);
  return {
    hazardType: type,
    severity,
    confidence: Math.max(0, Math.min(1, confidence)),
    direction,
    detectionCount: 1,
    firstSeenTick: tick,
    lastSeenTick: tick,
    isCriticalBypass: severity === 'critical',
  };
}

export function updateHazardPattern(
  existing: LocalHazardPattern,
  confidence: number,
  direction: HazardDirection,
  tick: number
): LocalHazardPattern {
  const avgConfidence = (existing.confidence * existing.detectionCount + confidence) /
    (existing.detectionCount + 1);
  const severity = estimateHazardSeverity(existing.hazardType, avgConfidence);
  return {
    ...existing,
    confidence: Math.max(0, Math.min(1, avgConfidence)),
    severity,
    direction,
    detectionCount: existing.detectionCount + 1,
    lastSeenTick: tick,
    isCriticalBypass: severity === 'critical',
  };
}

// ─── Guidance Generation ──────────────────────────────────────────────────────

export function getOfflineGuidance(
  type: StreetHazardType,
  direction: HazardDirection,
  confidence: number
): string {
  const pattern = getPatternForHazard(type);
  const directionStr = direction !== 'unknown' ? ` to the ${direction}` : '';
  const base = pattern.offlineGuidance;

  if (type === 'crossing') {
    return CROSSING_SAFETY_MESSAGE;
  }
  if (type === 'camera-failure') {
    return CAMERA_FAILURE_MESSAGE;
  }
  if (direction !== 'unknown' && direction !== 'ahead') {
    if (type === 'obstacle' || type === 'person-approaching' || type === 'bicycle-scooter') {
      return base.replace(' ahead', directionStr).replace(' approaching', ` approaching${directionStr}`);
    }
  }
  if (confidence < 0.4) {
    return `Possible ${type.replace(/-/g, ' ')}${directionStr}. Please proceed carefully.`;
  }
  return base;
}

export function buildSpokenMessage(
  pattern: PatternLibraryEntry,
  direction: HazardDirection,
  guidance: string
): string {
  const directionStr = direction !== 'unknown' && direction !== 'ahead'
    ? ` ${direction}`
    : direction === 'ahead' ? ' ahead' : '';
  return `${pattern.spokenPrefix} ${guidance}`;
}
