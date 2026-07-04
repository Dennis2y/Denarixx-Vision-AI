// ─── V13 Route Safety Engine ─────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Assesses navigation risk from detected objects and environment.

import type {
  RiskLevel,
  NavigationMode,
  NavigationSession,
  GuidanceLine,
  OutdoorEnvironment,
  IndoorZone,
} from '@/types/navigation';
import { RISK_ORDER } from '@/types/navigation';

// ─── Object Risk Map ─────────────────────────────────────────────────────────

const HIGH_RISK_LABELS = new Set([
  'car', 'construction_barrier', 'stairs', 'crosswalk', 'traffic_light',
]);
const MODERATE_RISK_LABELS = new Set([
  'bike', 'person', 'dog', 'wheelchair', 'shopping_cart',
]);
const LOW_RISK_LABELS = new Set([
  'chair', 'table', 'bag', 'sign', 'door',
]);

// ─── Core Risk Assessment ─────────────────────────────────────────────────────

export function assessRouteRisk(
  detectedLabels: string[],
  mode: NavigationMode,
  environment: OutdoorEnvironment | IndoorZone,
): RiskLevel {
  const labels = new Set(detectedLabels);

  // Outdoor-specific: cars or construction near a crossing = critical
  if (mode === 'outdoor' && environment === 'crossing') {
    if (labels.has('car')) return 'critical';
    if (labels.has('traffic_light') || labels.has('crosswalk')) return 'high';
  }

  // Any car in outdoor mode = high
  if (mode === 'outdoor' && labels.has('car')) return 'high';

  // Construction barrier = high anywhere
  if (labels.has('construction_barrier')) return 'high';

  // Stairs = moderate indoors (high if no elevator nearby)
  if (labels.has('stairs')) return mode === 'indoor' ? 'moderate' : 'high';

  // Check remaining labels
  let maxRisk: RiskLevel = 'clear';
  for (const label of labels) {
    if (HIGH_RISK_LABELS.has(label)) {
      maxRisk = maxRisk === 'critical' ? 'critical' : 'high';
    } else if (MODERATE_RISK_LABELS.has(label)) {
      if (RISK_ORDER.indexOf(maxRisk) < RISK_ORDER.indexOf('moderate')) {
        maxRisk = 'moderate';
      }
    } else if (LOW_RISK_LABELS.has(label)) {
      if (RISK_ORDER.indexOf(maxRisk) < RISK_ORDER.indexOf('low')) {
        maxRisk = 'low';
      }
    }
  }
  return maxRisk;
}

export function isRiskHigherThan(a: RiskLevel, b: RiskLevel): boolean {
  return RISK_ORDER.indexOf(a) > RISK_ORDER.indexOf(b);
}

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return isRiskHigherThan(a, b) ? a : b;
}

// ─── Risk Guidance ────────────────────────────────────────────────────────────

export function buildRiskGuidance(riskLevel: RiskLevel, detectedLabels: string[]): string {
  const obstacles = detectedLabels.filter(
    (l) => HIGH_RISK_LABELS.has(l) || MODERATE_RISK_LABELS.has(l),
  );
  const primary = obstacles[0]?.replace(/_/g, ' ') ?? 'obstacle';

  switch (riskLevel) {
    case 'critical': return `Stop immediately. ${primary} detected.`;
    case 'high': return `Slow down. ${primary} ahead.`;
    case 'moderate': return `Caution. ${primary} nearby.`;
    case 'low': return 'Minor obstacle detected. Proceed carefully.';
    case 'clear': return 'Path appears clear.';
  }
}

export function shouldPauseNavigation(riskLevel: RiskLevel): boolean {
  return riskLevel === 'critical' || riskLevel === 'high';
}

// ─── Session Risk Update ──────────────────────────────────────────────────────

export function updateSessionRisk(
  session: NavigationSession,
  riskLevel: RiskLevel,
): NavigationSession {
  if (session.riskLevel === riskLevel) return session;
  return { ...session, riskLevel, lastUpdatedAt: Date.now() };
}

export function isNavigationSafe(session: NavigationSession): boolean {
  return session.riskLevel === 'clear' || session.riskLevel === 'low';
}

// ─── Risk Label ───────────────────────────────────────────────────────────────

export function getRiskLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    clear: '✅ Clear',
    low: '🟢 Low Risk',
    moderate: '🟡 Moderate Risk',
    high: '🟠 High Risk',
    critical: '🔴 Critical',
  };
  return labels[level];
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    clear: 'text-green-400',
    low: 'text-green-400',
    moderate: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };
  return colors[level];
}

// ─── Route Segment Risk ──────────────────────────────────────────────────────

export function buildSafetyGuidanceLine(
  riskLevel: RiskLevel,
  detectedLabels: string[],
): GuidanceLine {
  const text = buildRiskGuidance(riskLevel, detectedLabels);
  const priority = riskLevel === 'critical' ? 'urgent'
    : riskLevel === 'high' ? 'high'
    : riskLevel === 'moderate' ? 'normal'
    : 'low';
  return { text, priority, suppressIfSimilar: riskLevel === 'clear', spokenAt: null };
}
