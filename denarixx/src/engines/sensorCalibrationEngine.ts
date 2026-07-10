// ─── Bring-Up Program: Sensor Calibration Engine ─────────────────────────────
// Pure functions — no async, no I/O.
// First-boot and maintenance calibration flows for prototype sensors.
// Accessible through voice commands and hardware buttons — no screen required.
// Calibration stored locally. Never uploaded by default.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalibrationStep =
  | 'camera-orientation'    // wearer looks straight ahead, system notes tilt
  | 'imu-bias'              // glasses stationary for 3s, measures drift
  | 'compass-heading'       // wearer rotates 360°, establishes magnetic north
  | 'wearer-forward'        // wearer looks straight, establishes forward vector
  | 'audio-level'           // TTS test phrase, wearer confirms audibility
  | 'haptic-strength'       // haptic test pulse, wearer confirms sensation
  | 'gnss-availability';    // check GPS fix, record quality

export type CalibrationStatus =
  | 'pending'
  | 'in-progress'
  | 'passed'
  | 'failed'
  | 'skipped';

export type CalibrationMode = 'first-boot' | 'maintenance' | 'partial';

export interface CalibrationStepRecord {
  step: CalibrationStep;
  status: CalibrationStatus;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number;
  value: CalibrationValue | null;
  notes: string;
}

// ─── Calibration Values (stored locally) ──────────────────────────────────────

export interface CameraOrientationCalibration {
  pitchDeg: number;       // tilt forward/back
  rollDeg: number;        // tilt side-to-side
  yawOffsetDeg: number;   // compass offset
}

export interface IMUBiasCalibration {
  accelBiasX: number;
  accelBiasY: number;
  accelBiasZ: number;
  gyroBiasX: number;
  gyroBiasY: number;
  gyroBiasZ: number;
  measurementDurationMs: number;
}

export interface CompassHeadingCalibration {
  magneticDeclinationDeg: number;
  hardIronOffsetX: number;
  hardIronOffsetY: number;
  softIronScaleX: number;
  softIronScaleY: number;
  quality: 'excellent' | 'good' | 'poor';
}

export interface AudioLevelCalibration {
  confirmedAudible: boolean;
  volumeLevel: number;    // 0–10
  echoReduction: boolean;
}

export interface HapticStrengthCalibration {
  confirmedFelt: boolean;
  intensityLevel: number; // 0–10
  patternsTested: string[];
}

export interface GNSSAvailabilityCalibration {
  fixAcquired: boolean;
  accuracyM: number | null;
  satelliteCount: number;
  indoorEnvironment: boolean;
}

export type CalibrationValue =
  | CameraOrientationCalibration
  | IMUBiasCalibration
  | CompassHeadingCalibration
  | AudioLevelCalibration
  | HapticStrengthCalibration
  | GNSSAvailabilityCalibration;

// ─── Session State ────────────────────────────────────────────────────────────

export const CALIBRATION_STEPS_FIRST_BOOT: CalibrationStep[] = [
  'camera-orientation',
  'imu-bias',
  'compass-heading',
  'wearer-forward',
  'audio-level',
  'haptic-strength',
  'gnss-availability',
];

export const CALIBRATION_STEPS_MAINTENANCE: CalibrationStep[] = [
  'imu-bias',
  'compass-heading',
  'audio-level',
  'haptic-strength',
];

export interface CalibrationSession {
  sessionId: string;
  mode: CalibrationMode;
  steps: CalibrationStepRecord[];
  currentStep: CalibrationStep | null;
  startedAt: number;
  completedAt: number | null;
  isComplete: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  storedLocally: boolean;     // always true — never uploaded by default
}

// ─── Session Creation ─────────────────────────────────────────────────────────

export function createCalibrationSession(
  sessionId: string,
  mode: CalibrationMode,
  nowMs: number,
): CalibrationSession {
  const stepsToRun =
    mode === 'first-boot' ? CALIBRATION_STEPS_FIRST_BOOT : CALIBRATION_STEPS_MAINTENANCE;

  const steps: CalibrationStepRecord[] = stepsToRun.map(step => ({
    step,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    value: null,
    notes: '',
  }));

  return {
    sessionId,
    mode,
    steps,
    currentStep: steps[0]?.step ?? null,
    startedAt: nowMs,
    completedAt: null,
    isComplete: false,
    passedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    storedLocally: true,
  };
}

// ─── Step Management ──────────────────────────────────────────────────────────

export function startStep(session: CalibrationSession, step: CalibrationStep, nowMs: number): CalibrationSession {
  const steps = session.steps.map(s =>
    s.step === step ? { ...s, status: 'in-progress' as CalibrationStatus, startedAt: nowMs } : s
  );
  return { ...session, steps, currentStep: step };
}

export function completeStep(
  session: CalibrationSession,
  step: CalibrationStep,
  success: boolean,
  value: CalibrationValue | null,
  notes: string,
  nowMs: number,
): CalibrationSession {
  const status: CalibrationStatus = success ? 'passed' : 'failed';
  const steps = session.steps.map(s => {
    if (s.step !== step) return s;
    return {
      ...s,
      status,
      completedAt: nowMs,
      durationMs: s.startedAt ? nowMs - s.startedAt : 0,
      value,
      notes,
    };
  });

  const passedCount = steps.filter(s => s.status === 'passed').length;
  const failedCount = steps.filter(s => s.status === 'failed').length;
  const skippedCount = steps.filter(s => s.status === 'skipped').length;
  const doneCount = passedCount + failedCount + skippedCount;
  const isComplete = doneCount >= steps.length;

  const pending = steps.find(s => s.status === 'pending');

  return {
    ...session,
    steps,
    currentStep: pending?.step ?? null,
    isComplete,
    completedAt: isComplete ? nowMs : null,
    passedCount,
    failedCount,
    skippedCount,
  };
}

export function skipStep(
  session: CalibrationSession,
  step: CalibrationStep,
  reason: string,
  nowMs: number,
): CalibrationSession {
  const steps = session.steps.map(s =>
    s.step === step
      ? { ...s, status: 'skipped' as CalibrationStatus, completedAt: nowMs, notes: reason }
      : s
  );
  const skippedCount = steps.filter(s => s.status === 'skipped').length;
  const pending = steps.find(s => s.status === 'pending');
  return { ...session, steps, currentStep: pending?.step ?? null, skippedCount };
}

// ─── Voice and Button Instructions ────────────────────────────────────────────

export function getStepInstruction(step: CalibrationStep): string {
  switch (step) {
    case 'camera-orientation':
      return 'Look straight ahead at eye level. Hold still for 3 seconds.';
    case 'imu-bias':
      return 'Place the glasses on a flat surface. Do not move them for 3 seconds.';
    case 'compass-heading':
      return 'Stand in an open area. Slowly rotate once in a full circle. Press the main button when done.';
    case 'wearer-forward':
      return 'Look straight ahead and press the main button to set your forward direction.';
    case 'audio-level':
      return 'A test phrase will play. Press volume up or down to adjust. Press the main button when the audio level feels right.';
    case 'haptic-strength':
      return 'A test vibration will pulse. Press volume up or down to adjust strength. Press the main button when correct.';
    case 'gnss-availability':
      return 'Checking for GPS signal. If you are indoors, this step will be skipped automatically.';
  }
}

export function getStepCompletionAnnouncement(
  step: CalibrationStep,
  passed: boolean,
): string {
  if (!passed) {
    switch (step) {
      case 'camera-orientation': return 'Camera orientation calibration failed. Using default values.';
      case 'imu-bias':           return 'IMU calibration failed. Motion guidance may be less accurate.';
      case 'compass-heading':    return 'Compass calibration failed. Heading guidance may be affected.';
      case 'gnss-availability':  return 'GPS unavailable. Outdoor navigation will use other sensors.';
      default:                   return `${step} calibration was not completed. Continuing with defaults.`;
    }
  }
  switch (step) {
    case 'camera-orientation': return 'Camera orientation saved.';
    case 'imu-bias':           return 'Motion sensor calibrated.';
    case 'compass-heading':    return 'Compass heading calibrated.';
    case 'wearer-forward':     return 'Forward direction saved.';
    case 'audio-level':        return 'Audio level saved.';
    case 'haptic-strength':    return 'Haptic strength saved.';
    case 'gnss-availability':  return 'GPS signal confirmed.';
  }
}

export function getCalibrationCompleteAnnouncement(session: CalibrationSession): string {
  if (session.failedCount === 0) {
    return 'Calibration complete. Glasses are ready to use.';
  }
  return `Calibration complete. ${session.passedCount} of ${session.steps.length} steps passed. ` +
         `${session.failedCount} steps failed — defaults will be used. Press the main button to start.`;
}

// ─── Stored Calibration Record ────────────────────────────────────────────────

export interface StoredCalibration {
  deviceId: string;
  calibratedAt: number;
  mode: CalibrationMode;
  cameraOrientation: CameraOrientationCalibration | null;
  imuBias: IMUBiasCalibration | null;
  compassHeading: CompassHeadingCalibration | null;
  audioLevel: AudioLevelCalibration | null;
  hapticStrength: HapticStrengthCalibration | null;
  gnssAvailability: GNSSAvailabilityCalibration | null;
  uploadedByDefault: false;  // structural: always false
}

export function buildStoredCalibration(
  deviceId: string,
  session: CalibrationSession,
  nowMs: number,
): StoredCalibration {
  const get = <T extends CalibrationValue>(step: CalibrationStep): T | null => {
    const record = session.steps.find(s => s.step === step && s.status === 'passed');
    return record?.value as T ?? null;
  };

  return {
    deviceId,
    calibratedAt: nowMs,
    mode: session.mode,
    cameraOrientation: get<CameraOrientationCalibration>('camera-orientation'),
    imuBias: get<IMUBiasCalibration>('imu-bias'),
    compassHeading: get<CompassHeadingCalibration>('compass-heading'),
    audioLevel: get<AudioLevelCalibration>('audio-level'),
    hapticStrength: get<HapticStrengthCalibration>('haptic-strength'),
    gnssAvailability: get<GNSSAvailabilityCalibration>('gnss-availability'),
    uploadedByDefault: false,
  };
}

export const CALIBRATION_PRIVACY_NOTE = 'Calibration data is stored locally on the device. It is never uploaded by default. Upload requires explicit consent.' as const;
