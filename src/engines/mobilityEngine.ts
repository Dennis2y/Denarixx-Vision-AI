/**
 * MobilityEngine (V6)
 *
 * Orchestrates spatial reasoning and path planning into a final
 * natural-language mobility guidance message.
 *
 * Pipeline:
 *   SpatialInput → SpatialReasoningEngine → PathPlanningEngine → guidance
 *
 * Pure engine — no async, no I/O.
 */

import { SpatialReasoningEngine } from './spatialReasoningEngine';
import { PathPlanningEngine } from './pathPlanningEngine';
import type { SpatialInput, SpatialObject, WorldModelSnapshot } from '@/types/spatial';

export class MobilityEngine {
  private spatialEngine = new SpatialReasoningEngine();
  private pathEngine = new PathPlanningEngine();

  /**
   * Full pipeline: raw detections → complete spatial snapshot + guidance text.
   */
  analyze(input: SpatialInput, frameIndex: number): WorldModelSnapshot {
    const objects = this.spatialEngine.analyze(input);
    const { corridor, recommendation, predictions } = this.pathEngine.plan(objects);

    return {
      objects,
      corridor,
      recommendation,
      predictions,
      landmarks: [], // populated by WorldModelEngine over time
      frameIndex,
      timestamp: new Date(),
    };
  }

  /**
   * Generate a concise spoken mobility guidance message.
   * Returns null when the guidance would add no value (e.g. repeated "clear").
   */
  generateGuidance(snapshot: WorldModelSnapshot, prevInstruction?: string): string | null {
    const { recommendation, objects, corridor } = snapshot;

    // Don't repeat the same advisory if nothing changed
    if (
      prevInstruction === recommendation.instruction &&
      recommendation.urgency === 'advisory'
    ) {
      return null;
    }

    const parts: string[] = [recommendation.instruction];

    // Add context for top nearby objects (max 2)
    if (recommendation.urgency !== 'immediate') {
      const nearby = objects
        .filter((o) => o.distanceMetres < 5 && Math.abs(o.lateralOffset) > 0.3)
        .sort((a, b) => a.distanceMetres - b.distanceMetres)
        .slice(0, 2);

      if (nearby.length > 0) {
        const descriptions = nearby.map((o) => this.spatialEngine.describeObject(o));
        parts.push(descriptions.join('. '));
      }
    }

    // Add corridor context for non-trivial situations
    if (corridor.clearanceMetres < 4 && corridor.clearanceMetres > 1) {
      parts.push(
        `${Math.round(corridor.widthMetres * 10) / 10} metres of clear space.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Generate a brief status summary for the spatial map panel header.
   */
  statusSummary(snapshot: WorldModelSnapshot): string {
    const { corridor, recommendation } = snapshot;
    if (!corridor.isPassable) return 'Path blocked';
    if (recommendation.urgency === 'immediate') return 'Action required';
    if (corridor.clearanceMetres >= 10) return 'Path clear';
    return `${Math.round(corridor.clearanceMetres)} m clearance`;
  }

  /**
   * Closest moving object that will intersect the user's path.
   */
  closestThreat(snapshot: WorldModelSnapshot): SpatialObject | null {
    const intersecting = snapshot.predictions
      .filter((p) => p.willIntersectPath)
      .map((p) => snapshot.objects.find((o) => o.id === p.objectId))
      .filter((o): o is SpatialObject => o !== undefined)
      .sort((a, b) => a.distanceMetres - b.distanceMetres);

    return intersecting[0] ?? null;
  }
}
