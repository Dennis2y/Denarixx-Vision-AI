/**
 * categorizeDetections — Sprint 4 pure helper
 *
 * Maps a Detection[] into the 7 structured categories required by Sprint 4.
 * Pure function — no I/O, no async, no browser APIs.
 * Importable in both server and client contexts.
 */

import type { Detection } from '@/types';
import type { DetectedCategories } from '@/types/vision';

// Label sets for each category (lowercase, exact-match after .trim())
const CATEGORY_MAP: Record<keyof DetectedCategories, ReadonlySet<string>> = {
  obstacles: new Set([
    'obstacle', 'barrier', 'bollard', 'bin', 'pole', 'cone',
    'table', 'chair', 'box', 'construction', 'debris', 'bucket',
    'hydrant', 'post', 'pillar', 'block',
  ]),
  people: new Set(['person', 'pedestrian', 'human', 'man', 'woman', 'child']),
  vehicles: new Set([
    'vehicle', 'car', 'truck', 'bus', 'motorcycle', 'bicycle',
    'cyclist', 'bike', 'van', 'scooter', 'moped', 'tram', 'train',
  ]),
  stairs: new Set(['stairs', 'staircase', 'step', 'steps', 'escalator', 'ladder', 'ramp']),
  doors: new Set(['door', 'gate', 'entrance', 'exit', 'opening', 'archway', 'hatch']),
  crossings: new Set([
    'crossing', 'road', 'intersection', 'junction', 'zebra',
    'crosswalk', 'pedestrian_crossing', 'pavement', 'kerb',
  ]),
  signs: new Set([
    'sign', 'text', 'signal', 'traffic_light', 'traffic light',
    'light', 'notice', 'board', 'indicator', 'display',
  ]),
};

/**
 * Categorise a flat Detection[] into the 7 Sprint-4 named categories.
 * A detection whose label matches multiple sets appears in each matching category.
 */
export function categorizeDetections(detections: Detection[]): DetectedCategories {
  const result: DetectedCategories = {
    obstacles: [],
    people: [],
    vehicles: [],
    stairs: [],
    doors: [],
    crossings: [],
    signs: [],
  };

  for (const detection of detections) {
    const label = detection.label.toLowerCase().trim();
    for (const [category, labelSet] of Object.entries(CATEGORY_MAP) as [keyof DetectedCategories, ReadonlySet<string>][]) {
      if (labelSet.has(label)) {
        result[category].push(detection);
      }
    }
  }

  return result;
}

/** True when at least one category contains a detection. */
export function hasAnyDetections(categories: DetectedCategories): boolean {
  return Object.values(categories).some((arr) => arr.length > 0);
}

/**
 * Returns the highest-priority occupied category.
 * Priority (highest → lowest): vehicles > stairs > crossings > obstacles > people > doors > signs
 */
export function getPriorityCategory(categories: DetectedCategories): keyof DetectedCategories | null {
  const priority: ReadonlyArray<keyof DetectedCategories> = [
    'vehicles', 'stairs', 'crossings', 'obstacles', 'people', 'doors', 'signs',
  ];
  return priority.find((cat) => categories[cat].length > 0) ?? null;
}

/** All 7 category keys in priority order. */
export const CATEGORY_PRIORITY_ORDER: ReadonlyArray<keyof DetectedCategories> = [
  'vehicles', 'stairs', 'crossings', 'obstacles', 'people', 'doors', 'signs',
];
