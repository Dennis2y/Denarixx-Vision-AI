/**
 * V4 Vision Provider types
 *
 * VisionAnalysisV4 is the rich structured output returned by all providers.
 * The legacy `detections` field (Detection[]) is derived from `objects` for
 * backward-compatibility with existing engine pipelines.
 *
 * Sprint 4: Added DetectedCategories (7 named categories) and the `categories`
 * field on VisionAnalysisV4 for structured downstream consumption.
 */

import type { Detection, HazardSeverity, VisionFrame } from '@/types';

export interface VisionHazardResult {
  type: string;
  severity: HazardSeverity;
  confidence: number;
  description: string;
}

/**
 * Sprint 4 — 7 named detection categories.
 * Populated by every VisionAnalysisProvider via categorizeDetections().
 */
export interface DetectedCategories {
  /** Objects blocking the path (bollards, bins, construction, etc.) */
  obstacles: Detection[];
  /** People near the user (pedestrians, bystanders) */
  people: Detection[];
  /** All road/path vehicles (car, bus, bicycle, etc.) */
  vehicles: Detection[];
  /** Stairs, steps, escalators, ramps */
  stairs: Detection[];
  /** Doors, gates, entrances, exits */
  doors: Detection[];
  /** Road crossings, intersections, zebra crossings */
  crossings: Detection[];
  /** Traffic signs, signals, notices, text boards */
  signs: Detection[];
}

export interface VisionAnalysisV4 {
  /** Plain-language description of the overall environment */
  environment: string;
  /** All detected objects mapped to the Detection interface */
  objects: Detection[];
  /** Sprint 4: objects grouped into 7 named categories */
  categories: DetectedCategories;
  /** Hazards identified in the frame, with severity and description */
  hazards: VisionHazardResult[];
  /** Overall confidence in this frame analysis (0–1) */
  confidence: number;
  /** Natural-language recommended action for the user */
  recommendedAction: string;
  /** Brief reasoning behind the analysis */
  reasoning: string;
  /** Name of the provider that produced this result */
  provider: string;
  /** true = real AI model was used; false = simulation */
  isRealAI: boolean;
  /** true = real provider failed and fell back to simulation */
  usedFallback: boolean;
}

export interface VisionAnalysisProvider {
  analyzeFrameV4(
    frame: VisionFrame,
    imageData: string | null
  ): Promise<VisionAnalysisV4>;
  readonly providerName: string;
  readonly isRealAI: boolean;
}
