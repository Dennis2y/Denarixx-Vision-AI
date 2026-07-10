// ─── V14 Field of View Engine ─────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Classifies object positions into directional zones for speech guidance.

import type {
  FovZone,
  FusedDetection,
  GlassesCameraPosition,
  DetectionPriority,
} from '@/types/glasses';

// ─── Zone Classification ──────────────────────────────────────────────────────

/**
 * Classify which field-of-view zone an object falls into based on
 * the camera position and horizontal offset (0=left edge, 1=right edge).
 */
export function classifyFovZone(
  cameraPosition: GlassesCameraPosition | 'phone',
  normalizedX: number,  // 0.0 (left) to 1.0 (right) of frame
  normalizedY = 0.5,    // 0.0 (top) to 1.0 (bottom) of frame
): FovZone {
  if (normalizedY < 0.2) return 'overhead';
  if (normalizedY > 0.85) return 'below';

  if (cameraPosition === 'left') return 'left';
  if (cameraPosition === 'right') return 'right';

  // Front or phone camera: classify by horizontal position
  if (normalizedX < 0.3) return 'left';
  if (normalizedX > 0.7) return 'right';
  return 'center';
}

// ─── Directional Instructions ─────────────────────────────────────────────────

export function buildDirectionalInstruction(zone: FovZone, objectLabel: string): string {
  const label = objectLabel.replace(/_/g, ' ');
  switch (zone) {
    case 'center': return `${capitalise(label)} ahead.`;
    case 'left': return `${capitalise(label)} on your left.`;
    case 'right': return `${capitalise(label)} on your right.`;
    case 'overhead': return `${capitalise(label)} overhead.`;
    case 'below': return `${capitalise(label)} below — watch your step.`;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function estimateObjectDirection(zone: FovZone): 'ahead' | 'left' | 'right' | 'above' | 'below' {
  switch (zone) {
    case 'center': return 'ahead';
    case 'left': return 'left';
    case 'right': return 'right';
    case 'overhead': return 'above';
    case 'below': return 'below';
  }
}

// ─── Threat Analysis ──────────────────────────────────────────────────────────

export function hasCenterThreat(detections: FusedDetection[]): boolean {
  return detections.some(
    (d) => d.fovZone === 'center' && (d.priority === 'critical' || d.priority === 'high'),
  );
}

export function getPeripheralWarnings(detections: FusedDetection[]): FusedDetection[] {
  return detections.filter(
    (d) => (d.fovZone === 'left' || d.fovZone === 'right') &&
           (d.priority === 'critical' || d.priority === 'high' || d.priority === 'medium'),
  );
}

export function getHighestPriorityByZone(
  detections: FusedDetection[],
): Partial<Record<FovZone, FusedDetection>> {
  const result: Partial<Record<FovZone, FusedDetection>> = {};
  const priorityOrder: DetectionPriority[] = ['critical', 'high', 'medium', 'low'];

  for (const det of detections) {
    const existing = result[det.fovZone];
    if (!existing) {
      result[det.fovZone] = det;
    } else {
      if (priorityOrder.indexOf(det.priority) < priorityOrder.indexOf(existing.priority)) {
        result[det.fovZone] = det;
      }
    }
  }
  return result;
}

// ─── FOV Coverage ─────────────────────────────────────────────────────────────

export function computeFovCoverage(
  activeCameras: Array<GlassesCameraPosition | 'phone'>,
): FovZone[] {
  const coverage = new Set<FovZone>();
  for (const cam of activeCameras) {
    switch (cam) {
      case 'front':
      case 'phone':
        coverage.add('center');
        coverage.add('overhead');
        coverage.add('below');
        break;
      case 'left':
        coverage.add('left');
        break;
      case 'right':
        coverage.add('right');
        break;
      case 'external':
        coverage.add('center');
        break;
    }
  }
  return Array.from(coverage);
}

export function isBlindsideRisk(
  coverage: FovZone[],
  detections: FusedDetection[],
): boolean {
  const uncoveredZones: FovZone[] = ['left', 'right', 'overhead', 'below', 'center'].filter(
    (z) => !coverage.includes(z as FovZone),
  ) as FovZone[];
  return uncoveredZones.some((zone) =>
    detections.some((d) => d.fovZone === zone && d.priority === 'high'),
  );
}

// ─── Peripheral Speech ────────────────────────────────────────────────────────

export function buildPeripheralWarningText(peripherals: FusedDetection[]): string | null {
  if (peripherals.length === 0) return null;
  const p = peripherals[0];
  return buildDirectionalInstruction(p.fovZone, p.label);
}

export function formatFovZone(zone: FovZone): string {
  const labels: Record<FovZone, string> = {
    center: 'Ahead',
    left: 'Left',
    right: 'Right',
    overhead: 'Overhead',
    below: 'Below',
  };
  return labels[zone];
}
