/**
 * SensorFusionEngine (V7)
 *
 * Takes raw sensor readings and produces a fused SensorContext:
 *   - Motion state classification (walking / standing / turning / running / riding)
 *   - Heading fusion (compass alpha preferred over GPS heading)
 *   - Battery-aware mode detection
 *   - Alert urgency modifier based on motion
 *
 * Pure engine — no async, no I/O. Safe inside React refs.
 */

import type {
  GPSReading,
  CompassReading,
  MotionReading,
  BatteryState,
  MotionState,
  SensorContext,
  SensorPermissions,
} from '@/types/sensors';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Acceleration magnitude thresholds (m/s²) for motion classification */
const MOTION_THRESHOLDS = {
  standing:  0.3,   // below this → standing
  walking:   2.5,   // 0.3–2.5 → walking
  running:   6.0,   // 2.5–6.0 → running
  riding:    0.2,   // very low variance + high speed → riding
} as const;

/** Rotation rate threshold (°/s) to classify as turning */
const TURNING_RATE_THRESHOLD = 25;

/** Sliding window size for acceleration smoothing */
const WINDOW_SIZE = 8;

/** Low battery threshold */
const LOW_BATTERY = 0.2;

// ─── Motion classification ────────────────────────────────────────────────────

export class SensorFusionEngine {
  private magnitudeWindow: number[] = [];
  private rotationWindow: number[] = [];

  /**
   * Classify motion state from a single MotionReading.
   * Uses a sliding window to smooth noisy accelerometer data.
   */
  classifyMotion(motion: MotionReading | null, gps: GPSReading | null): MotionState {
    if (!motion) {
      // Fallback: use GPS speed if available
      if (gps?.speed !== null && gps?.speed !== undefined) {
        const s = gps.speed;
        if (s < 0.3) return 'standing';
        if (s < 2.0) return 'walking';
        if (s < 5.0) return 'running';
        return 'riding';
      }
      return 'unknown';
    }

    const acc = motion.acceleration ?? motion.accelerationIncludingGravity;

    // Calculate magnitude of linear acceleration vector
    let magnitude = 0;
    if (acc) {
      magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    }

    // Sliding window for magnitude
    this.magnitudeWindow.push(magnitude);
    if (this.magnitudeWindow.length > WINDOW_SIZE) this.magnitudeWindow.shift();
    const avgMag = this.magnitudeWindow.reduce((a, b) => a + b, 0) / this.magnitudeWindow.length;

    // Rotation rate for turning detection
    let rotRate = 0;
    if (motion.rotationRate) {
      rotRate = Math.abs(motion.rotationRate.gamma); // yaw-like rotation on a phone
    }
    this.rotationWindow.push(rotRate);
    if (this.rotationWindow.length > WINDOW_SIZE) this.rotationWindow.shift();
    const avgRot = this.rotationWindow.reduce((a, b) => a + b, 0) / this.rotationWindow.length;

    // Priority: turning check first (can overlap with walking)
    if (avgRot > TURNING_RATE_THRESHOLD && avgMag > MOTION_THRESHOLDS.standing) {
      return 'turning';
    }

    if (avgMag < MOTION_THRESHOLDS.standing) return 'standing';
    if (avgMag < MOTION_THRESHOLDS.walking) return 'walking';
    if (avgMag < MOTION_THRESHOLDS.running) return 'running';
    return 'riding';
  }

  /**
   * Fuse compass and GPS heading into a single bearing.
   * Compass (DeviceOrientationEvent.alpha) is preferred when available.
   */
  fuseHeading(
    compass: CompassReading | null,
    gps: GPSReading | null
  ): number | null {
    if (compass) {
      // alpha = 0 means device top points north
      return Math.round(compass.alpha * 10) / 10;
    }
    if (gps?.heading !== null && gps?.heading !== undefined) {
      return Math.round(gps.heading * 10) / 10;
    }
    return null;
  }

  /**
   * Convert a numeric heading to a human-readable compass direction.
   */
  headingToDirection(degrees: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return dirs[index];
  }

  /**
   * Determine if low-power mode should reduce processing.
   */
  isLowPowerMode(battery: BatteryState | null, batteryAwareMode: boolean): boolean {
    if (!batteryAwareMode || !battery) return false;
    return battery.level < LOW_BATTERY && !battery.charging;
  }

  /**
   * Produce a complete fused SensorContext from raw readings.
   */
  fuse(
    gps: GPSReading | null,
    compass: CompassReading | null,
    motion: MotionReading | null,
    battery: BatteryState | null,
    permissions: SensorPermissions,
    batteryAwareMode: boolean
  ): SensorContext {
    const motionState = this.classifyMotion(motion, gps);
    const headingDegrees = this.fuseHeading(compass, gps);
    const isLowPower = this.isLowPowerMode(battery, batteryAwareMode);
    const isActive =
      gps !== null || compass !== null || motion !== null || battery !== null;

    return {
      gps,
      compass,
      motion,
      motionState,
      battery,
      permissions,
      headingDegrees,
      isLowPowerMode: isLowPower,
      isActive,
      lastUpdated: new Date(),
    };
  }

  /**
   * Urgency modifier based on motion state.
   * Running or riding makes hazard alerts more urgent.
   * Standing makes them less so.
   */
  urgencyModifier(motionState: MotionState): 'elevate' | 'normal' | 'reduce' {
    if (motionState === 'running' || motionState === 'riding') return 'elevate';
    if (motionState === 'standing') return 'reduce';
    return 'normal';
  }

  /**
   * Recommended frame interval in milliseconds based on context.
   * Low power or standing → slower polling to save CPU/battery.
   */
  recommendedFrameInterval(
    motionState: MotionState,
    isLowPower: boolean
  ): number {
    if (isLowPower) return 8000;
    if (motionState === 'standing') return 5000;
    if (motionState === 'running' || motionState === 'riding') return 2000;
    return 3000; // default walking pace
  }

  /**
   * Human-readable motion state description for UI.
   */
  describeMotionState(state: MotionState): string {
    const descriptions: Record<MotionState, string> = {
      walking:  'Walking',
      running:  'Running',
      standing: 'Standing',
      turning:  'Turning',
      riding:   'In transit',
      unknown:  'Unknown',
    };
    return descriptions[state];
  }

  /**
   * Generate a context note about motion for spatial guidance.
   * Returns null if motion state adds no guidance value.
   */
  motionNote(state: MotionState): string | null {
    switch (state) {
      case 'running': return 'Moving quickly — alerts elevated.';
      case 'turning': return 'Turning detected.';
      case 'riding':  return 'In transit — alerts elevated.';
      case 'standing': return null; // no note for standing
      default:        return null;
    }
  }

  reset() {
    this.magnitudeWindow = [];
    this.rotationWindow = [];
  }
}
