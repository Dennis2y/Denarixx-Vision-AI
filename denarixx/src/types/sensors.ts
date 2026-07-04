/**
 * Phone Sensor types (V7)
 *
 * Shared types for GPS, compass, IMU, battery, vibration, and
 * the fused SensorContext used by all downstream engines.
 */

// ─── Raw sensor readings ──────────────────────────────────────────────────────

export interface GPSReading {
  latitude: number;
  longitude: number;
  /** Accuracy radius in metres */
  accuracy: number;
  /** GPS track heading in degrees (0–360). null when stationary. */
  heading: number | null;
  /** Speed in metres per second. null when unavailable. */
  speed: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  timestamp: Date;
}

export interface CompassReading {
  /** Device azimuth (degrees from magnetic north, 0–360) */
  alpha: number;
  /** Front-to-back tilt (−180 to 180) */
  beta: number;
  /** Left-to-right tilt (−90 to 90) */
  gamma: number;
  /** True if azimuth is referenced to geographic (true) north */
  absolute: boolean;
  timestamp: Date;
}

export interface MotionVector {
  x: number;
  y: number;
  z: number;
}

export interface MotionReading {
  /** Linear acceleration in m/s² (gravity excluded) */
  acceleration: MotionVector | null;
  /** Total acceleration including gravity */
  accelerationIncludingGravity: MotionVector | null;
  /** Rotation rate in degrees/s */
  rotationRate: { alpha: number; beta: number; gamma: number } | null;
  /** Sensor polling interval in ms */
  interval: number;
  timestamp: Date;
}

export interface BatteryState {
  /** 0.0–1.0 */
  level: number;
  charging: boolean;
  /** Seconds until full charge. null when discharging or unknown. */
  chargingTime: number | null;
  /** Seconds until empty. null when charging or unknown. */
  dischargingTime: number | null;
}

// ─── Motion classification ────────────────────────────────────────────────────

export type MotionState =
  | 'walking'
  | 'running'
  | 'standing'
  | 'turning'
  | 'riding'   // vehicle (high-speed, smooth)
  | 'unknown';

// ─── Sensor permissions ───────────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface SensorPermissions {
  geolocation: PermissionStatus;
  deviceOrientation: PermissionStatus;
  deviceMotion: PermissionStatus;
  /** navigator.vibrate API present */
  vibration: boolean;
  /** navigator.getBattery API present */
  battery: boolean;
}

// ─── Fused sensor context ─────────────────────────────────────────────────────

export interface SensorContext {
  gps: GPSReading | null;
  compass: CompassReading | null;
  motion: MotionReading | null;
  motionState: MotionState;
  battery: BatteryState | null;
  permissions: SensorPermissions;
  /**
   * Fused heading in degrees (0–360, 0 = north).
   * Prefers compass alpha; falls back to GPS heading.
   */
  headingDegrees: number | null;
  /** Battery level < 0.2 and not charging */
  isLowPowerMode: boolean;
  /** Whether any sensors are active */
  isActive: boolean;
  lastUpdated: Date;
}

// ─── Location privacy ─────────────────────────────────────────────────────────

export type LocationPrivacyLevel = 'none' | 'fuzzy' | 'precise';

export interface FuzzedLocation {
  /** Snapped coordinates (precision depends on privacy level) */
  latitude: number;
  longitude: number;
  /** Reported accuracy is inflated to reflect fuzzing */
  accuracy: number;
  privacyLevel: LocationPrivacyLevel;
}

// ─── Vibration patterns ───────────────────────────────────────────────────────

export type VibrationPattern =
  | 'critical'   // [300, 100, 300, 100, 300] — three strong pulses
  | 'high'       // [200, 100, 200]           — two pulses
  | 'medium'     // [150]                     — single pulse
  | 'stop'       // [500, 200, 500]           — long-short-long
  | 'waypoint'   // [50, 50, 50]              — three quick taps
  | 'clear'      // [80]                      — short single tap (all clear)
  | 'turn_left'  // [50, 30, 100]             — short-long
  | 'turn_right' // [100, 30, 50]             — long-short
  | 'confirm';   // [30]                      — brief acknowledgement

export const VIBRATION_MS: Record<VibrationPattern, number[]> = {
  critical:    [300, 100, 300, 100, 300],
  high:        [200, 100, 200],
  medium:      [150],
  stop:        [500, 200, 500],
  waypoint:    [50, 50, 50],
  clear:       [80],
  turn_left:   [50, 30, 100],
  turn_right:  [100, 30, 50],
  confirm:     [30],
};

// ─── Sensor settings (added to AppSettings in V7) ────────────────────────────

export interface SensorSettings {
  /** Whether GPS is requested at all */
  locationEnabled: boolean;
  /** Precision of GPS data used/shown */
  locationPrecision: LocationPrivacyLevel;
  /** Whether to store locations to AI memory */
  locationMemoryEnabled: boolean;
  /** Whether DeviceMotion / DeviceOrientation is requested */
  motionEnabled: boolean;
  /** Whether to use navigator.vibrate for haptic alerts */
  vibrationEnabled: boolean;
  /** Low-power mode: 2× frame interval, minimal audio */
  batteryAwareMode: boolean;
}

export const SENSOR_DEFAULTS: SensorSettings = {
  locationEnabled: false,
  locationPrecision: 'fuzzy',
  locationMemoryEnabled: false,
  motionEnabled: true,
  vibrationEnabled: true,
  batteryAwareMode: true,
};
