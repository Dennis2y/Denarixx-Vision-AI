/**
 * V4 Vision Provider types
 *
 * VisionAnalysisV4 is the rich structured output returned by all providers.
 * The legacy `detections` field (Detection[]) is derived from `objects` for
 * backward-compatibility with existing engine pipelines.
 */

import type { Detection, HazardSeverity, VisionFrame } from '@/types';

export interface VisionHazardResult {
  type: string;
  severity: HazardSeverity;
  confidence: number;
  description: string;
}

export interface VisionAnalysisV4 {
  /** Plain-language description of the overall environment */
  environment: string;
  /** All detected objects mapped to the Detection interface */
  objects: Detection[];
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
