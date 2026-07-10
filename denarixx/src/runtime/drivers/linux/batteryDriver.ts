// ─── Battery Driver ───────────────────────────────────────────────────────────
// I2C driver for MAX17048 or BQ27220 Li-Po fuel gauge.
//
// Real implementation (physical device required):
//   MAX17048 (address 0x36):
//     open("/dev/i2c-1"); ioctl(I2C_SLAVE, 0x36)
//     SOC:     read register 0x04 (uint16 >> 8 = percent; LSB = 1/256 %)
//     VCELL:   read register 0x02 (uint16 * 78.125 µV = cell voltage)
//     CONFIG:  register 0x0C — set ALRT threshold for low-battery alert
//     STATUS:  register 0x1A — check RI (reset indicator), low SOC alert
//
//   BQ27220 (address 0x55, alternate):
//     Standard Battery Data Class registers; richer chemistry model
//
// Power safety:
//   If SOC ≤ 5%: announce + start 60-second graceful shutdown countdown.
//   If SOC = 0%: immediate safe shutdown (save session, release camera/audio).
//   Temperature ≥ 85°C: announce overheating + immediate shutdown.
//
// Node.js: npm install i2c-bus (pure JS, reads /dev/i2c-N via ioctl)

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BatteryDriverStatus = 'not-initialized' | 'ready' | 'low-battery' | 'critical' | 'failed' | 'closed';

export interface BatteryDriverConfig {
  i2cBus: number;
  i2cAddress: number;    // 0x36 (MAX17048) or 0x55 (BQ27220)
  chipModel: 'max17048' | 'bq27220';
  lowBatteryThresholdPct: number;    // default 15
  criticalBatteryThresholdPct: number; // default 5
  overheatThresholdC: number;        // default 85
}

export interface BatteryReading {
  socPct: number;                     // State of Charge 0.0–100.0
  cellVoltageV: number;               // Cell voltage in volts
  temperatureC: number;               // Battery / die temperature
  isCharging: boolean;
  estimatedMinutesRemaining: number | null;
  timestampMs: number;
  isSimulated: false;
}

export interface BatteryDriverState {
  config: BatteryDriverConfig;
  status: BatteryDriverStatus;
  readCount: number;
  errorCount: number;
  lastErrorMessage: string | null;
  i2cAccessible: boolean;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createBatteryDriverState(config: BatteryDriverConfig): BatteryDriverState {
  const i2cPath = `/dev/i2c-${config.i2cBus}`;
  return {
    config, status: 'not-initialized',
    readCount: 0, errorCount: 0, lastErrorMessage: null,
    i2cAccessible: fs.existsSync(i2cPath),
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeBatteryDriver(
  state: BatteryDriverState,
): { state: BatteryDriverState; error: string | null } {
  const i2cPath = `/dev/i2c-${state.config.i2cBus}`;
  if (!state.i2cAccessible) {
    const error = `I2C bus not found at ${i2cPath}. ` +
      `Enable I2C on compute board. ` +
      `Check: i2cdetect -y ${state.config.i2cBus} → should show 0x${state.config.i2cAddress.toString(16)} (${state.config.chipModel})`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  const error = `Battery driver not yet implemented. ` +
    `Install i2c-bus: npm install i2c-bus. ` +
    `Then read ${state.config.chipModel === 'max17048' ? 'SOC register 0x04 and VCELL 0x02' : 'BQ27220 standard registers'}.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Read Battery State ───────────────────────────────────────────────────────

export function readBatteryState(
  state: BatteryDriverState,
): { state: BatteryDriverState; reading: BatteryReading | null; error: string | null } {
  if (state.status !== 'ready' && state.status !== 'low-battery' && state.status !== 'critical') {
    return { state, reading: null, error: `Battery driver not ready: ${state.status}` };
  }
  const error = `Battery read not yet implemented.`;
  return { state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error }, reading: null, error };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getBatteryDriverHealth(state: BatteryDriverState): BatteryDriverStatus {
  return state.status;
}

export function shutdownBatteryDriver(state: BatteryDriverState): BatteryDriverState {
  return { ...state, status: 'closed' };
}
