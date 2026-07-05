// Sprint 10 — Context Awareness Engine (pure functional, no async, no I/O)
// Detects environmental context and derives adaptation rules.

import type {
  ContextType,
  ContextSnapshot,
  ContextAdaptationRule,
  AlertFrequency,
} from '@/types/companion';
import type { Detection } from '@/types/index';

// ─── Detection label sets ─────────────────────────────────────────────────────

const INDOOR_LABELS = new Set([
  'door', 'stairs', 'elevator', 'chair', 'table', 'corridor', 'hallway',
  'escalator', 'wall', 'counter', 'desk', 'shelf', 'window',
]);

const OUTDOOR_LABELS = new Set([
  'vehicle', 'car', 'bus', 'bicycle', 'truck', 'road', 'pavement',
  'traffic light', 'curb', 'crossing', 'tree', 'bench', 'pillar',
]);

const CROWDED_LABELS = new Set([
  'person', 'people', 'crowd', 'group',
]);

// Only highly specific crossing indicators — generic vehicle/road labels belong to outdoor
const CROSSING_LABELS = new Set([
  'crossing', 'traffic light', 'crosswalk', 'pedestrian crossing',
]);

const POOR_LIGHTING_LABELS = new Set([
  'shadow', 'darkness', 'dim', 'low light', 'night',
]);

// ─── Context classification ───────────────────────────────────────────────────

export function classifyContext(
  detections: Detection[],
  sceneDescription: string | null,
  sensorIndoors?: boolean,
): ContextType {
  const labels = detections.map(d => d.label.toLowerCase());
  const scene = (sceneDescription ?? '').toLowerCase();

  // Sensor override takes priority — hardware knows indoors/outdoors better than labels
  if (sensorIndoors !== undefined) {
    return sensorIndoors ? 'indoor' : 'outdoor';
  }

  // Priority: crossing > poor lighting > crowded > indoor/outdoor
  const hasCrossing =
    labels.some(l => CROSSING_LABELS.has(l)) ||
    scene.includes('crossing');

  if (hasCrossing) return 'crossing';

  const hasPoorLight =
    labels.some(l => POOR_LIGHTING_LABELS.has(l)) ||
    scene.includes('dark') ||
    scene.includes('dim');

  if (hasPoorLight) return 'poor_lighting';

  const isCrowded =
    labels.filter(l => CROWDED_LABELS.has(l)).length >= 2 ||
    scene.includes('crowd') ||
    scene.includes('busy');

  if (isCrowded) return 'crowded';

  const indoorScore = labels.filter(l => INDOOR_LABELS.has(l)).length;
  const outdoorScore = labels.filter(l => OUTDOOR_LABELS.has(l)).length;

  if (indoorScore > outdoorScore) return 'indoor';
  if (outdoorScore > indoorScore) return 'outdoor';

  const isQuiet = detections.length <= 1 && !hasCrowded(labels);
  if (isQuiet) return 'quiet';

  return 'unknown';
}

function hasCrowded(labels: string[]): boolean {
  return labels.some(l => CROWDED_LABELS.has(l));
}

// ─── Build full context snapshot ──────────────────────────────────────────────

export function buildContextSnapshot(
  detections: Detection[],
  sceneDescription: string | null,
  options: {
    sensorIndoors?: boolean;
    isNight?: boolean;
  } = {},
): ContextSnapshot {
  const labels = detections.map(d => d.label.toLowerCase());
  const scene = (sceneDescription ?? '').toLowerCase();

  const contextType = classifyContext(detections, sceneDescription, options.sensorIndoors);

  const isIndoors =
    options.sensorIndoors ??
    (contextType === 'indoor' || labels.some(l => INDOOR_LABELS.has(l)));

  const isCrowded =
    labels.filter(l => CROWDED_LABELS.has(l)).length >= 2 ||
    scene.includes('crowd');

  const isCrossing = contextType === 'crossing';

  const isQuiet = detections.length <= 1 && !isCrowded;

  const isPoorLighting =
    contextType === 'poor_lighting' ||
    labels.some(l => POOR_LIGHTING_LABELS.has(l)) ||
    scene.includes('dark') ||
    (options.isNight ?? false);

  const isNight = options.isNight ?? false;

  const confidence = computeContextConfidence(detections, contextType);

  return {
    contextType,
    isIndoors: !!isIndoors,
    isCrowded,
    isNight,
    isCrossing,
    isQuiet,
    isPoorLighting,
    confidence,
    detectedLabels: detections.map(d => d.label),
  };
}

function computeContextConfidence(
  detections: Detection[],
  contextType: ContextType,
): number {
  if (detections.length === 0) return 0.3;
  const avgConf =
    detections.reduce((s, d) => s + d.confidence, 0) / detections.length;
  // If unknown context, lower confidence
  if (contextType === 'unknown') return Math.min(avgConf, 0.5);
  return Math.round(avgConf * 100) / 100;
}

// ─── Adaptation rules ─────────────────────────────────────────────────────────

const CONTEXT_RULES: Record<ContextType, ContextAdaptationRule> = {
  crossing: {
    contextType: 'crossing',
    alertFrequencyBoost: 2.0,
    speechAmountAdjustment: 0,
    forceDetail: true,
    safetyOverride: true,
  },
  poor_lighting: {
    contextType: 'poor_lighting',
    alertFrequencyBoost: 1.5,
    speechAmountAdjustment: 1,
    forceDetail: true,
    safetyOverride: false,
  },
  crowded: {
    contextType: 'crowded',
    alertFrequencyBoost: 1.5,
    speechAmountAdjustment: -1,
    forceDetail: false,
    safetyOverride: false,
  },
  indoor: {
    contextType: 'indoor',
    alertFrequencyBoost: 1.0,
    speechAmountAdjustment: 0,
    forceDetail: false,
    safetyOverride: false,
  },
  outdoor: {
    contextType: 'outdoor',
    alertFrequencyBoost: 1.2,
    speechAmountAdjustment: 0,
    forceDetail: false,
    safetyOverride: false,
  },
  quiet: {
    contextType: 'quiet',
    alertFrequencyBoost: 0.8,
    speechAmountAdjustment: 1,
    forceDetail: false,
    safetyOverride: false,
  },
  unknown: {
    contextType: 'unknown',
    alertFrequencyBoost: 1.0,
    speechAmountAdjustment: 0,
    forceDetail: false,
    safetyOverride: false,
  },
};

export function getAdaptationRule(contextType: ContextType): ContextAdaptationRule {
  return CONTEXT_RULES[contextType] ?? CONTEXT_RULES.unknown;
}

// ─── Alert frequency adjustment ───────────────────────────────────────────────

export function adjustAlertFrequency(
  baseFrequency: AlertFrequency,
  rule: ContextAdaptationRule,
): AlertFrequency {
  if (rule.alertFrequencyBoost >= 1.5) {
    if (baseFrequency === 'low') return 'medium';
    return 'high';
  }
  if (rule.alertFrequencyBoost <= 0.8) {
    if (baseFrequency === 'high') return 'medium';
    return 'low';
  }
  return baseFrequency;
}

// ─── Context label helpers ────────────────────────────────────────────────────

export function contextTypeLabel(type: ContextType): string {
  const labels: Record<ContextType, string> = {
    indoor: 'Indoors',
    outdoor: 'Outdoors',
    crossing: 'Road Crossing',
    crowded: 'Crowded Area',
    quiet: 'Quiet Area',
    poor_lighting: 'Poor Lighting',
    unknown: 'Unknown',
  };
  return labels[type] ?? 'Unknown';
}

export function contextTypeIcon(type: ContextType): string {
  const icons: Record<ContextType, string> = {
    indoor: '🏠',
    outdoor: '🌳',
    crossing: '🚦',
    crowded: '👥',
    quiet: '🤫',
    poor_lighting: '🌙',
    unknown: '?',
  };
  return icons[type] ?? '?';
}
