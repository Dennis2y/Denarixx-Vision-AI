/**
 * WorldModelEngine (V6)
 *
 * Maintains a persistent in-memory model of the user's surroundings
 * across multiple vision frames:
 *
 * - Object registry: recent objects with TTL eviction
 * - Landmark memory: permanent features seen over multiple frames
 * - Safe area tracking: areas confirmed clear across N frames
 *
 * Pure engine — no async, no I/O. Safe inside React refs.
 */

import type { SpatialObject, Landmark, LandmarkType, WorldModelSnapshot } from '@/types/spatial';

const OBJECT_TTL_MS = 10_000; // 10 s — objects expire if not re-seen
const LANDMARK_MIN_SIGHTINGS = 2; // must appear in this many frames to be stored
const MAX_LANDMARKS = 30;

const LANDMARK_LABELS: Record<string, LandmarkType> = {
  door: 'door',
  stairs: 'stairs',
  staircase: 'stairs',
  elevator: 'elevator',
  lift: 'elevator',
  shop: 'shop',
  store: 'shop',
  'bus stop': 'bus_stop',
  crosswalk: 'crosswalk',
  'pedestrian crossing': 'crosswalk',
  station: 'station',
  'traffic light': 'traffic_light',
  'traffic lights': 'traffic_light',
  bench: 'bench',
};

function classifyLandmarkType(label: string): LandmarkType | null {
  const lower = label.toLowerCase();
  for (const [key, type] of Object.entries(LANDMARK_LABELS)) {
    if (lower.includes(key)) return type;
  }
  return null;
}

export class WorldModelEngine {
  private objects = new Map<string, SpatialObject & { expiresAt: number }>();
  private landmarks = new Map<string, Landmark>();
  private safeFrameCount = 0;
  private frameCount = 0;

  /**
   * Ingest a new snapshot; update objects and landmark memory.
   * Returns an enriched snapshot with persistent landmarks.
   */
  update(snapshot: WorldModelSnapshot): WorldModelSnapshot {
    this.frameCount++;
    const now = Date.now();

    // Evict expired objects
    for (const [id, obj] of this.objects) {
      if (obj.expiresAt < now) this.objects.delete(id);
    }

    // Merge new objects into registry
    for (const obj of snapshot.objects) {
      this.objects.set(obj.id, { ...obj, expiresAt: now + OBJECT_TTL_MS });
    }

    // Update landmark memory from permanent objects
    for (const obj of snapshot.objects) {
      if (!obj.isPermanent) continue;
      const lmType = classifyLandmarkType(obj.label);
      if (!lmType) continue;

      const lmId = `lm-${obj.label.toLowerCase().replace(/\s+/g, '-')}`;
      const existing = this.landmarks.get(lmId);

      if (existing) {
        this.landmarks.set(lmId, {
          ...existing,
          lastSeenAt: new Date(),
          sightingCount: existing.sightingCount + 1,
          distanceMetres: obj.distanceMetres,
          direction: obj.direction,
        });
      } else if (this.landmarks.size < MAX_LANDMARKS) {
        this.landmarks.set(lmId, {
          id: lmId,
          type: lmType,
          label: obj.label,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          sightingCount: 1,
          distanceMetres: obj.distanceMetres,
          direction: obj.direction,
        });
      }
    }

    // Track safe (no-hazard) frames
    const isHazardous = snapshot.recommendation.urgency !== 'advisory';
    if (!isHazardous) this.safeFrameCount++;
    else this.safeFrameCount = 0;

    // Return snapshot enriched with confirmed landmarks
    const confirmedLandmarks = [...this.landmarks.values()].filter(
      (lm) => lm.sightingCount >= LANDMARK_MIN_SIGHTINGS
    );

    return { ...snapshot, landmarks: confirmedLandmarks };
  }

  /** Retrieve all currently-tracked objects (including recently-seen, now off-screen) */
  getAllObjects(): SpatialObject[] {
    return [...this.objects.values()];
  }

  /** Retrieve landmark memory */
  getLandmarks(): Landmark[] {
    return [...this.landmarks.values()].filter(
      (lm) => lm.sightingCount >= LANDMARK_MIN_SIGHTINGS
    );
  }

  /** True if the last N frames were hazard-free */
  isExtendedSafe(frames = 3): boolean {
    return this.safeFrameCount >= frames;
  }

  /** Total frames processed since last reset */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Generate a landmark recall message if a recently-seen landmark matches
   * the current scene (for the landmark memory system).
   */
  checkLandmarkRecall(sceneSummary: string): Landmark | null {
    const lower = sceneSummary.toLowerCase();
    for (const lm of this.landmarks.values()) {
      if (lm.sightingCount < LANDMARK_MIN_SIGHTINGS) continue;
      if (lower.includes(lm.label.toLowerCase())) return lm;
    }
    return null;
  }

  reset() {
    this.objects.clear();
    this.landmarks.clear();
    this.safeFrameCount = 0;
    this.frameCount = 0;
  }
}
