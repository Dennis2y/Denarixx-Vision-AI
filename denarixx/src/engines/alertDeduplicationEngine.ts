/**
 * AlertDeduplicationEngine — Sprint 5
 *
 * Tracks which hazard labels were present in the previous camera frame vs the
 * current one. Used by AlertQualityEngine to suppress repeated alerts for the
 * same ongoing hazard and to detect when a hazard (re-)appears.
 *
 * Pure state machine — no I/O, no async.
 *
 * Speak conditions detected by this engine:
 *   appeared   → new_hazard (never seen) or hazard_returned (was gone, came back)
 *   disappeared→ no alert needed
 *   ongoing    → speak only if confidence increased by ≥ MEANINGFUL_CONFIDENCE_DELTA
 */

import type { Detection } from '@/types';
import type { DeduplicationFrame } from '@/types/cognitive';

/** Minimum confidence delta that counts as "object is closer / risk increased" */
const MEANINGFUL_CONFIDENCE_DELTA = 0.10;

export class AlertDeduplicationEngine {
  private prevLabels = new Set<string>();
  private currentLabels = new Set<string>();
  private prevConfidences = new Map<string, number>();
  private currentConfidences = new Map<string, number>();
  /** All labels ever observed in PREVIOUS frames (snapshot taken before each update) */
  private everSeenBeforeFrame = new Set<string>();
  /** All labels ever observed including the current frame (grows monotonically) */
  private everSeen = new Set<string>();
  private frameIndex = 0;

  /**
   * Process a new frame. Returns the diff between this frame and the previous one.
   * Always call this once per frame before calling any query methods.
   */
  update(detections: Detection[]): DeduplicationFrame {
    const isFirstFrame = this.frameIndex === 0;

    // Capture everSeen state BEFORE adding current frame labels.
    // This lets isNew/isReturn correctly classify labels as "first time ever" vs "returning".
    this.everSeenBeforeFrame = new Set(this.everSeen);

    // Advance rolling window
    this.prevLabels = new Set(this.currentLabels);
    this.prevConfidences = new Map(this.currentConfidences);
    this.currentLabels.clear();
    this.currentConfidences.clear();

    for (const d of detections) {
      const label = d.label.toLowerCase().trim();
      this.currentLabels.add(label);
      // When multiple detections of same label, keep highest confidence
      const existing = this.currentConfidences.get(label) ?? 0;
      if (d.confidence > existing) this.currentConfidences.set(label, d.confidence);
      this.everSeen.add(label);
    }

    this.frameIndex++;

    const appeared: string[] = [];
    const disappeared: string[] = [];
    const ongoing: string[] = [];

    for (const label of this.currentLabels) {
      if (!this.prevLabels.has(label)) {
        appeared.push(label);
      } else {
        ongoing.push(label);
      }
    }

    for (const label of this.prevLabels) {
      if (!this.currentLabels.has(label)) {
        disappeared.push(label);
      }
    }

    return { appeared, disappeared, ongoing, isFirstFrame };
  }

  /**
   * True when a label appeared this frame AND was never seen in any PRIOR frame.
   * Indicates a genuinely new hazard type, not a returning one.
   */
  isNew(label: string): boolean {
    const l = label.toLowerCase().trim();
    return this.currentLabels.has(l) && !this.prevLabels.has(l) && !this.everSeenBeforeFrame.has(l);
  }

  /**
   * True when a label appeared this frame AND was seen at some earlier point
   * (hazard that disappeared and came back).
   */
  isReturn(label: string): boolean {
    const l = label.toLowerCase().trim();
    return this.currentLabels.has(l) && !this.prevLabels.has(l) && this.everSeenBeforeFrame.has(l);
  }

  /**
   * True when a label is ongoing AND its confidence increased by ≥ MEANINGFUL_CONFIDENCE_DELTA.
   * Indicates the object is likely getting closer / risk is escalating.
   */
  isMeaningfulChange(label: string, currentConfidence: number): boolean {
    const l = label.toLowerCase().trim();
    if (!this.prevLabels.has(l)) return false; // not ongoing
    const prev = this.prevConfidences.get(l) ?? 0;
    return currentConfidence - prev >= MEANINGFUL_CONFIDENCE_DELTA;
  }

  /** The confidence delta for an ongoing label (positive = got more confident) */
  getConfidenceDelta(label: string, currentConfidence: number): number {
    const l = label.toLowerCase().trim();
    const prev = this.prevConfidences.get(l) ?? 0;
    return currentConfidence - prev;
  }

  getPrevLabels(): ReadonlySet<string> { return this.prevLabels; }
  getCurrentLabels(): ReadonlySet<string> { return this.currentLabels; }
  getEverSeen(): ReadonlySet<string> { return this.everSeen; }
  getFrameIndex(): number { return this.frameIndex; }

  reset(): void {
    this.prevLabels.clear();
    this.currentLabels.clear();
    this.prevConfidences.clear();
    this.currentConfidences.clear();
    this.everSeen.clear();
    this.everSeenBeforeFrame.clear();
    this.frameIndex = 0;
  }
}
