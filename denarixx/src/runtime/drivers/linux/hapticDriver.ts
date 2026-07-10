// ─── Haptic Driver ────────────────────────────────────────────────────────────
// I2C driver for TI DRV2605L haptic motor controller (ERM or LRA actuator).
//
// Real implementation (physical device required):
//   - Open I2C: open("/dev/i2c-1", O_RDWR); ioctl(fd, I2C_SLAVE, 0x5A)
//   - Initialize: write MODE register (0x01) → 0x00 (Internal trigger)
//   - Load waveform library: write LIBRARY register (0x03) → 1 (ERM) or 6 (LRA)
//   - Queue waveforms: write WAVESEQ1–8 registers (0x04–0x0B) → waveform IDs
//   - Trigger: write GO register (0x0C) → 0x01
//   - Stop: write GO register → 0x00
//   - Close: close(fd)
//
// Alternative (PWM GPIO):
//   /sys/class/pwm/pwmchip0/pwm0/duty_cycle and period for simple vibration pulses.
//
// Node.js I2C binding:
//   npm install i2c-bus    (pure JS, uses /dev/i2c-N, no native compilation)
//
// DRV2605L waveform IDs (library 1 ERM):
//   Strong click:   1   (use for critical alerts)
//   Medium click:   11  (use for normal alerts)
//   Triple buzz:    58  (use for emergency stop)
//   Short buzz:     47  (use for waypoint)

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HapticDriverStatus = 'not-initialized' | 'ready' | 'vibrating' | 'degraded' | 'failed' | 'closed';
export type HapticActuatorType = 'erm' | 'lra';
export type HapticPatternId = 'critical-alert' | 'normal-alert' | 'emergency-stop' | 'waypoint' | 'low-battery' | 'startup' | 'shutdown';

export interface HapticDriverConfig {
  i2cBus: number;            // e.g. 1 for /dev/i2c-1
  i2cAddress: number;        // 0x5A for DRV2605L
  actuatorType: HapticActuatorType;
  library: number;           // 1 = ERM, 6 = LRA
}

export interface HapticDriverState {
  config: HapticDriverConfig;
  status: HapticDriverStatus;
  patternsPlayed: number;
  errorCount: number;
  lastErrorMessage: string | null;
  i2cDeviceAccessible: boolean;
}

export interface HapticWaveformSequence {
  waveformIds: number[];    // DRV2605L waveform IDs; max 8; 0 = end of sequence
  description: string;
}

// ─── Pattern Library ──────────────────────────────────────────────────────────

export const HAPTIC_PATTERNS: Record<HapticPatternId, HapticWaveformSequence> = {
  'critical-alert':  { waveformIds: [1, 1, 0],    description: 'Strong double click — critical hazard' },
  'normal-alert':    { waveformIds: [11, 0],       description: 'Medium click — normal alert' },
  'emergency-stop':  { waveformIds: [58, 0],       description: 'Triple buzz — emergency stop' },
  'waypoint':        { waveformIds: [47, 0],       description: 'Short buzz — waypoint reached' },
  'low-battery':     { waveformIds: [14, 14, 0],   description: 'Double short — low battery' },
  'startup':         { waveformIds: [52, 0],       description: 'Ramp up — device started' },
  'shutdown':        { waveformIds: [51, 0],       description: 'Ramp down — device shutting down' },
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createHapticDriverState(config: HapticDriverConfig): HapticDriverState {
  const i2cPath = `/dev/i2c-${config.i2cBus}`;
  const i2cDeviceAccessible = fs.existsSync(i2cPath);
  return {
    config, status: 'not-initialized',
    patternsPlayed: 0, errorCount: 0, lastErrorMessage: null,
    i2cDeviceAccessible,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeHapticDriver(
  state: HapticDriverState,
): { state: HapticDriverState; error: string | null } {
  const i2cPath = `/dev/i2c-${state.config.i2cBus}`;
  if (!state.i2cDeviceAccessible) {
    const error = `I2C bus not found at ${i2cPath}. ` +
      `Enable I2C on compute board (dtparam=i2c_arm=on for RPi). ` +
      `Check: i2cdetect -y ${state.config.i2cBus} should show device at 0x${state.config.i2cAddress.toString(16)}.`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  // TODO (physical bring-up): open /dev/i2c-1; ioctl I2C_SLAVE 0x5A; write MODE=0, LIB, etc.
  // Using i2c-bus package: npm install i2c-bus
  const error = `Haptic driver not yet implemented. Install i2c-bus: npm install i2c-bus, then implement I2C writes.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Play Pattern ─────────────────────────────────────────────────────────────

export function playHapticPattern(
  state: HapticDriverState,
  patternId: HapticPatternId,
): { state: HapticDriverState; error: string | null } {
  if (state.status !== 'ready') {
    const error = `Cannot play haptic pattern: driver status is '${state.status}'.`;
    return { state, error };
  }

  const pattern = HAPTIC_PATTERNS[patternId];
  // TODO: write waveform IDs to WAVESEQ registers; write GO=1; await completion
  const error = `Haptic play not yet implemented for pattern: ${pattern.description}`;
  return {
    state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error },
    error,
  };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getHapticDriverHealth(state: HapticDriverState): HapticDriverStatus {
  return state.status;
}

export function shutdownHapticDriver(state: HapticDriverState): HapticDriverState {
  // TODO: write MODE=0x40 (standby); close I2C fd
  return { ...state, status: 'closed' };
}
