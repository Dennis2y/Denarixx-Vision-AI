// ─── V12 Object Tracking Engine ──────────────────────────────────────────────
// Pure functions — no async, no I/O.
// IoU-based multi-object tracking with velocity estimation and position prediction.

import type {
  BoundingBox,
  DetectedObject,
  TrackedObject,
  TrackerState,
  ObjectVelocity,
} from '@/types/vision12';
import {
  estimateDepthFromBox,
  buildVelocity,
  predictNextPosition,
  assignObjectPriority,
} from '@/engines/depthReasoningEngine';

// ─── Constants ───────────────────────────────────────────────────────────────

const IOU_MATCH_THRESHOLD = 0.25;
const MAX_HISTORY_LENGTH = 10;
const MAX_LOST_FRAMES = 5;

// ─── Tracker Lifecycle ───────────────────────────────────────────────────────

export function createTrackerState(): TrackerState {
  return {
    tracks: new Map(),
    nextTrackId: 1,
    frameTimestamp: Date.now(),
  };
}

// ─── IoU ─────────────────────────────────────────────────────────────────────

export function computeIoU(a: BoundingBox, b: BoundingBox): number {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const intersection = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  if (intersection === 0) return 0;

  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  return intersection / (aArea + bArea - intersection);
}

// ─── Velocity Estimation ─────────────────────────────────────────────────────

export function estimateVelocityFromHistory(
  history: TrackedObject['history'],
): ObjectVelocity | null {
  if (history.length < 2) return null;
  const len = history.length;
  // Use last 3 frames for smoothing
  const recent = history.slice(Math.max(0, len - 3));
  let totalDx = 0, totalDy = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].boundingBox;
    const curr = recent[i].boundingBox;
    // Center-to-center delta
    const cx1 = prev.x + prev.width / 2, cy1 = prev.y + prev.height / 2;
    const cx2 = curr.x + curr.width / 2, cy2 = curr.y + curr.height / 2;
    totalDx += cx2 - cx1;
    totalDy += cy2 - cy1;
  }
  const n = recent.length - 1;
  return buildVelocity(totalDx / n, totalDy / n);
}

// ─── Tracker Update ──────────────────────────────────────────────────────────

export interface RawDetection {
  label: DetectedObject['label'];
  boundingBox: BoundingBox;
  confidence: number;
}

export function updateTracker(
  state: TrackerState,
  detections: RawDetection[],
  timestamp: number = Date.now(),
): TrackerState {
  const newTracks = new Map<string, TrackedObject>(state.tracks);
  const matchedTrackIds = new Set<string>();
  let nextTrackId = state.nextTrackId;

  for (const det of detections) {
    let bestTrackId: string | null = null;
    let bestIoU = IOU_MATCH_THRESHOLD;

    // Find best matching existing track (same label + highest IoU)
    for (const [trackId, track] of newTracks) {
      if (track.label !== det.label) continue;
      if (matchedTrackIds.has(trackId)) continue;
      const latestBox = track.history[track.history.length - 1]?.boundingBox;
      if (!latestBox) continue;
      const iou = computeIoU(det.boundingBox, latestBox);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestTrackId = trackId;
      }
    }

    if (bestTrackId !== null) {
      // Update existing track
      const track = newTracks.get(bestTrackId)!;
      const newHistory = [
        ...track.history.slice(-(MAX_HISTORY_LENGTH - 1)),
        { timestamp, boundingBox: det.boundingBox, confidence: det.confidence },
      ];
      const velocity = estimateVelocityFromHistory(newHistory);
      const distance = estimateDepthFromBox(det.boundingBox);
      const priority = assignObjectPriority(det.label, distance);
      newTracks.set(bestTrackId, {
        ...track,
        history: newHistory,
        velocity,
        distance,
        priority,
        lostFrames: 0,
        predictedPosition: velocity ? predictNextPosition(det.boundingBox, velocity) : null,
      });
      matchedTrackIds.add(bestTrackId);
    } else {
      // Create new track
      const trackId = `T${String(nextTrackId++).padStart(3, '0')}`;
      const distance = estimateDepthFromBox(det.boundingBox);
      const priority = assignObjectPriority(det.label, distance);
      newTracks.set(trackId, {
        trackId,
        label: det.label,
        history: [{ timestamp, boundingBox: det.boundingBox, confidence: det.confidence }],
        velocity: null,
        predictedPosition: null,
        lostFrames: 0,
        distance,
        priority,
        firstSeen: timestamp,
      });
      matchedTrackIds.add(trackId);
    }
  }

  // Increment lostFrames for unmatched tracks
  for (const [trackId, track] of newTracks) {
    if (!matchedTrackIds.has(trackId)) {
      newTracks.set(trackId, { ...track, lostFrames: track.lostFrames + 1 });
    }
  }

  // Prune tracks that have been lost too long
  for (const [trackId, track] of newTracks) {
    if (track.lostFrames > MAX_LOST_FRAMES) {
      newTracks.delete(trackId);
    }
  }

  return {
    tracks: newTracks,
    nextTrackId,
    frameTimestamp: timestamp,
  };
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export function getActiveTracks(state: TrackerState): TrackedObject[] {
  return Array.from(state.tracks.values()).filter((t) => t.lostFrames === 0);
}

export function getLostTracks(state: TrackerState): TrackedObject[] {
  return Array.from(state.tracks.values()).filter((t) => t.lostFrames > 0);
}

export function getTrackById(state: TrackerState, trackId: string): TrackedObject | undefined {
  return state.tracks.get(trackId);
}

export function trackCount(state: TrackerState): number {
  return state.tracks.size;
}

export function activeTrackCount(state: TrackerState): number {
  return getActiveTracks(state).length;
}

// ─── Convert tracked objects to DetectedObjects ──────────────────────────────

export function tracksToDetectedObjects(
  state: TrackerState,
): DetectedObject[] {
  return getActiveTracks(state).map((track) => {
    const latest = track.history[track.history.length - 1];
    const firstSeen = track.firstSeen;
    return {
      trackId: track.trackId,
      label: track.label,
      confidence: latest?.confidence ?? 0,
      distance: track.distance,
      priority: track.priority,
      boundingBox: latest?.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
      velocity: track.velocity,
      firstSeen,
      lastSeen: latest?.timestamp ?? firstSeen,
      frameCount: track.history.length,
      timeToCollision: null,
    };
  });
}
