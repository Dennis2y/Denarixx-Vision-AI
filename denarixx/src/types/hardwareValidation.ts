// ─── Hardware Validation Record Types ────────────────────────────────────────
// Schema for hardware validation records produced during physical bring-up.
// These records must be populated from real hardware test runs — never generated
// automatically from software-only tests.
//
// A validation record is ONLY valid when:
//   - physicalHardwareConnected === true
//   - testOperator is a named person who was present
//   - rawTestResultRef points to captured output (log file, terminal dump, video)
//   - result is 'pass' (never assume pass without a captured run)

// ─── Device Identity ──────────────────────────────────────────────────────────

export interface HardwareDeviceProfile {
  deviceId: string;              // e.g. 'denarixx-p1-001'
  hardwareRevision: string;      // e.g. 'P1.0'
  computeBoard: string;          // e.g. 'Raspberry Pi CM4 / NVIDIA Jetson Nano'
  camera: string;                // e.g. 'OV9281 x2 MIPI-CSI2 @60fps'
  audioOutput: string;           // e.g. 'MAX98357A I2S → YB150 bone-conduction'
  haptic: string;                // e.g. 'DRV2605L I2C'
  imu: string;                   // e.g. 'ICM-42688-P SPI'
  batteryGauge: string;          // e.g. 'MAX17048 I2C'
  gnss: string;                  // e.g. 'u-blox M10 UART' or 'none'
  softwareBaseline: string;      // DENARIXX_VISION_PROTOTYPE_BASELINE value
  osVersion: string;             // e.g. 'Ubuntu 22.04.4 LTS aarch64'
  kernelVersion: string;         // e.g. '5.15.0-1038-raspi'
}

// ─── Test Environment ─────────────────────────────────────────────────────────

export interface TestEnvironmentInfo {
  testDate: string;              // ISO 8601 date string: 2026-07-10T14:32:00Z
  testOperator: string;          // Full name of engineer who ran the test
  location: string;              // e.g. 'Lab bench', 'Indoor corridor', 'Outdoor footpath'
  lightingConditions?: string;   // e.g. 'Office fluorescent ~500 lux'
  ambientNoise?: string;         // e.g. 'Quiet office ~35 dB'
  networkCondition?: string;     // e.g. 'WiFi good signal', 'Offline'
}

// ─── Measured Performance Metrics ─────────────────────────────────────────────

export interface MeasuredPerformanceMetrics {
  cameraFpsActual: number | null;        // Real measured FPS from V4L2 capture
  inferenceLatencyMs: number | null;     // P95 real inference latency (ONNX on device)
  guardianLatencyMs: number | null;      // Guardian decision latency per frame
  audioLatencyMs: number | null;         // From alert to first audio byte (TTS → ALSA)
  hapticLatencyMs: number | null;        // From command to DRV2605L waveform start
  sessionDurationMinutes: number | null; // Length of continuous test run
  batteryDrainPctPerHour: number | null; // Measured drain rate under load
  peakTemperatureC: number | null;       // Maximum SoC/case temperature during run
  droppedFramesPct: number | null;       // % frames dropped (camera or inference overrun)
}

// ─── Per-Subsystem Validation ─────────────────────────────────────────────────

export type SubsystemValidationStatus = 'pass' | 'fail' | 'blocked' | 'not-tested';

export interface SubsystemValidationResult {
  subsystem: string;
  status: SubsystemValidationStatus;
  notes: string;
  failureDescription?: string;
}

// ─── Model Validation ─────────────────────────────────────────────────────────

export interface ModelValidationInfo {
  modelFilename: string;
  modelSha256: string;           // SHA-256 hex checksum of the .onnx file
  modelSizeBytes: number;
  modelInputShape: string;       // e.g. '[1, 3, 640, 640]'
  modelOutputShape: string;      // e.g. '[1, 84, 8400]'
  detectionClassCount: number;
  confidenceThreshold: number;
  nmsIouThreshold: number;
  realInferenceTestedOnDevice: boolean;
}

// ─── Raw Test Evidence ────────────────────────────────────────────────────────

export interface RawTestEvidence {
  terminalLogRef: string;        // Relative path or URL to captured terminal output
  videoRef?: string;             // Path/URL to screen recording or device video
  latencyProfileRef?: string;    // Path to latency measurement CSV or JSON
  notes: string;
}

// ─── Validation Record ────────────────────────────────────────────────────────

export type HardwareValidationResult = 'pass' | 'fail' | 'blocked';

export interface HardwareValidationRecord {
  recordId: string;              // Unique ID: e.g. 'HVR-2026-07-10-001'
  deviceProfile: HardwareDeviceProfile;
  testEnvironment: TestEnvironmentInfo;
  modelValidation: ModelValidationInfo | null;
  measuredMetrics: MeasuredPerformanceMetrics;
  subsystemResults: SubsystemValidationResult[];
  rawEvidence: RawTestEvidence;

  physicalHardwareConnected: boolean;   // MUST be true for result to be credible
  result: HardwareValidationResult;
  resultJustification: string;         // Why pass/fail/blocked; must cite evidence

  generatedByAutomation: false;        // Always false — records are written by humans
  warningIfFalse: 'This record was not generated automatically. A named engineer must sign off.';
}

// ─── Helper — Empty Record Template ──────────────────────────────────────────
// Returns an unfilled template; result defaults to 'blocked' until physically tested.

export function createEmptyValidationRecord(recordId: string): HardwareValidationRecord {
  return {
    recordId,
    deviceProfile: {
      deviceId: 'FILL_IN',
      hardwareRevision: 'FILL_IN',
      computeBoard: 'FILL_IN',
      camera: 'FILL_IN',
      audioOutput: 'FILL_IN',
      haptic: 'FILL_IN',
      imu: 'FILL_IN',
      batteryGauge: 'FILL_IN',
      gnss: 'none',
      softwareBaseline: 'v0.2.0-hardware-bringup',
      osVersion: 'FILL_IN',
      kernelVersion: 'FILL_IN',
    },
    testEnvironment: {
      testDate: 'FILL_IN',
      testOperator: 'FILL_IN',
      location: 'FILL_IN',
    },
    modelValidation: null,
    measuredMetrics: {
      cameraFpsActual: null,
      inferenceLatencyMs: null,
      guardianLatencyMs: null,
      audioLatencyMs: null,
      hapticLatencyMs: null,
      sessionDurationMinutes: null,
      batteryDrainPctPerHour: null,
      peakTemperatureC: null,
      droppedFramesPct: null,
    },
    subsystemResults: [],
    rawEvidence: {
      terminalLogRef: 'FILL_IN',
      notes: 'FILL_IN',
    },
    physicalHardwareConnected: false,
    result: 'blocked',
    resultJustification: 'Not yet physically tested. Fill in all fields after running on device.',
    generatedByAutomation: false,
    warningIfFalse: 'This record was not generated automatically. A named engineer must sign off.',
  };
}
