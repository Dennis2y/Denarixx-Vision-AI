// ─── V14 Multi-Camera Fusion Engine ──────────────────────────────────────────
// Pure functions — no async, no I/O.
// Fuses detections from multiple camera sources into a single unified frame.

import type {
  FusedDetection,
  FusedFrame,
  GlassesState,
  GlassesCameraPosition,
  FovZone,
  DetectionPriority,
  MultiCameraConfig,
} from '@/types/glasses';
import { DEFAULT_MULTICAMERA_CONFIG } from '@/types/glasses';
import { classifyFovZone, getPeripheralWarnings } from '@/engines/fieldOfViewEngine';
import { buildDirectionalInstruction } from '@/engines/fieldOfViewEngine';

// ─── Priority Map ─────────────────────────────────────────────────────────────

const HIGH_PRIORITY_LABELS = new Set(['car', 'construction_barrier', 'stairs', 'crossing']);
const MEDIUM_PRIORITY_LABELS = new Set(['person', 'bike', 'dog', 'wheelchair']);

function labelToPriority(label: string): DetectionPriority {
  if (HIGH_PRIORITY_LABELS.has(label)) return 'high';
  if (MEDIUM_PRIORITY_LABELS.has(label)) return 'medium';
  return 'low';
}

// ─── Detection → FusedDetection ───────────────────────────────────────────────

export function buildFusedDetection(
  label: string,
  confidence: number,
  cameraSource: GlassesCameraPosition | 'phone',
  normalizedX = 0.5,
  normalizedY = 0.5,
): FusedDetection {
  const fovZone = classifyFovZone(cameraSource, normalizedX, normalizedY);
  const priority = labelToPriority(label);
  return {
    label,
    confidence,
    fovZone,
    cameraSource,
    priority,
    estimatedDistanceM: null,
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function deduplicateDetections(
  detections: FusedDetection[],
  config: MultiCameraConfig = DEFAULT_MULTICAMERA_CONFIG,
): FusedDetection[] {
  const seen = new Map<string, FusedDetection>();
  for (const det of detections) {
    const existing = seen.get(det.label);
    if (!existing || det.confidence > existing.confidence + config.deduplicationThreshold) {
      seen.set(det.label, det);
    } else if (!existing && det.fovZone === 'center') {
      // Prefer center-zone detections for dedup
      seen.set(det.label, det);
    }
  }
  return Array.from(seen.values());
}

// ─── Priority Ordering ────────────────────────────────────────────────────────

const PRIORITY_ORDER: DetectionPriority[] = ['critical', 'high', 'medium', 'low'];

export function prioritizeHazards(detections: FusedDetection[]): FusedDetection[] {
  return [...detections].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });
}

// ─── Fusion ───────────────────────────────────────────────────────────────────

export function fuseDetectionSets(
  detectionSets: Array<{ source: GlassesCameraPosition | 'phone'; labels: string[] }>,
  config: MultiCameraConfig = DEFAULT_MULTICAMERA_CONFIG,
): FusedDetection[] {
  const all: FusedDetection[] = [];
  for (const { source, labels } of detectionSets) {
    for (const label of labels) {
      const normalizedX = source === 'left' ? 0.1 : source === 'right' ? 0.9 : 0.5;
      all.push(buildFusedDetection(label, 0.75, source, normalizedX));
    }
  }
  const deduped = deduplicateDetections(all, config);
  return prioritizeHazards(deduped);
}

// ─── Fused Frame Builder ──────────────────────────────────────────────────────

export function buildFusedFrame(
  state: GlassesState,
  detectionSets: Array<{ source: GlassesCameraPosition | 'phone'; labels: string[] }>,
  config: MultiCameraConfig = DEFAULT_MULTICAMERA_CONFIG,
): FusedFrame {
  const detections = fuseDetectionSets(detectionSets, config);
  const peripheralWarnings = getPeripheralWarnings(detections);
  const hasPeripheral = peripheralWarnings.length > 0;

  const coveredZones: FovZone[] = [];
  for (const { source } of detectionSets) {
    if (source === 'front' || source === 'phone') {
      if (!coveredZones.includes('center')) coveredZones.push('center');
    }
    if (source === 'left' && !coveredZones.includes('left')) coveredZones.push('left');
    if (source === 'right' && !coveredZones.includes('right')) coveredZones.push('right');
  }

  const top = detections[0] ?? null;
  const guidanceText = top
    ? buildDirectionalInstruction(top.fovZone, top.label)
    : null;

  return {
    timestamp: Date.now(),
    detections,
    primarySource: state.activeSource as GlassesCameraPosition | 'phone' | 'none',
    fusedCameraCount: detectionSets.length,
    fieldOfViewCoverage: coveredZones,
    hasPeripheralThreat: hasPeripheral,
    guidanceText,
  };
}

// ─── Guidance Extraction ──────────────────────────────────────────────────────

export function getHighestPriorityDetection(frame: FusedFrame): FusedDetection | null {
  return frame.detections[0] ?? null;
}

export function formatFusedGuidance(frame: FusedFrame): string {
  if (frame.detections.length === 0) return '';
  const top = frame.detections[0];
  return buildDirectionalInstruction(top.fovZone, top.label);
}

export function buildMultiCameraStatusText(
  fusedCameraCount: number,
  hasPeripheral: boolean,
): string {
  const base = `${fusedCameraCount} camera${fusedCameraCount !== 1 ? 's' : ''} active.`;
  return hasPeripheral ? `${base} Peripheral warning detected.` : base;
}

// ─── Simulated Detection Scenarios ───────────────────────────────────────────

const SIMULATION_SCENARIOS: Array<Array<{ source: GlassesCameraPosition | 'phone'; labels: string[] }>> = [
  [{ source: 'front', labels: ['person', 'pavement'] }],
  [{ source: 'front', labels: ['stairs'] }, { source: 'left', labels: ['door'] }],
  [{ source: 'front', labels: ['person'] }, { source: 'right', labels: ['bike'] }],
  [{ source: 'front', labels: ['car', 'crosswalk'] }],
  [{ source: 'front', labels: [] }, { source: 'left', labels: ['person'] }, { source: 'right', labels: ['sign'] }],
];

export function getSimulatedDetectionSet(
  tick: number,
): Array<{ source: GlassesCameraPosition | 'phone'; labels: string[] }> {
  return SIMULATION_SCENARIOS[tick % SIMULATION_SCENARIOS.length];
}
