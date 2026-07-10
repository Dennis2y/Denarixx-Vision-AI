// ─── IMU Driver ───────────────────────────────────────────────────────────────
// SPI/I2C driver for ICM-42688-P or LSM6DSO inertial measurement unit.
//
// Real implementation (physical device required):
//   SPI (ICM-42688-P preferred — lower noise, higher ODR):
//     open("/dev/spidev0.0", O_RDWR); spi_ioc_transfer; read FIFO registers
//     Config: GYRO_CONFIG0 (ODR 1kHz, ±2000 dps); ACCEL_CONFIG0 (ODR 1kHz, ±16g)
//
//   I2C (LSM6DSO alternate):
//     open("/dev/i2c-1"); ioctl(I2C_SLAVE, 0x6A); read registers 0x22–0x2D (accel+gyro)
//     Config: CTRL1_XL (6.66 kHz, 16g); CTRL2_G (6.66 kHz, 2000 dps)
//
// Node.js binding: npm install spi-device (SPI) or npm install i2c-bus (I2C)
//
// Sensor fusion:
//   Raw accel + gyro → Madgwick/Mahony filter → quaternion → heading
//   This driver provides raw calibrated readings; fusion is a separate engine.
//
// Motion state classification:
//   accel magnitude < 0.1 m/s² variance → stationary
//   steady periodic accel pattern → walking
//   high magnitude irregular pattern → running

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IMUDriverStatus = 'not-initialized' | 'ready' | 'degraded' | 'failed' | 'closed';
export type IMUInterface = 'spi' | 'i2c';
export type IMUChip = 'icm-42688-p' | 'lsm6dso' | 'unknown';

export interface IMUDriverConfig {
  interface: IMUInterface;
  devicePath: string;      // e.g. /dev/spidev0.0 or /dev/i2c-1
  i2cAddress?: number;     // e.g. 0x6A for LSM6DSO (I2C only)
  chip: IMUChip;
  outputDataRateHz: number; // e.g. 1000
}

export interface IMURawReading {
  accelX_mss: number;   // m/s² — NOT simulated
  accelY_mss: number;
  accelZ_mss: number;
  gyroX_dps: number;    // degrees/second
  gyroY_dps: number;
  gyroZ_dps: number;
  temperatureC: number; // die temperature
  timestampMs: number;
  isSimulated: false;
}

export interface IMUDriverState {
  config: IMUDriverConfig;
  status: IMUDriverStatus;
  samplesRead: number;
  errorCount: number;
  lastErrorMessage: string | null;
  deviceAccessible: boolean;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createIMUDriverState(config: IMUDriverConfig): IMUDriverState {
  const deviceAccessible = fs.existsSync(config.devicePath);
  return {
    config, status: 'not-initialized',
    samplesRead: 0, errorCount: 0, lastErrorMessage: null,
    deviceAccessible,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeIMUDriver(
  state: IMUDriverState,
): { state: IMUDriverState; error: string | null } {
  if (!state.deviceAccessible) {
    const iface = state.config.interface === 'spi' ? 'SPI' : 'I2C';
    const error = `${iface} device not found at ${state.config.devicePath}. ` +
      `Enable ${iface} on compute board. ` +
      (state.config.interface === 'spi'
        ? `Verify dtoverlay=spi0-1cs in /boot/config.txt. Check: ls /dev/spidev0.0`
        : `Verify dtparam=i2c_arm=on. Check: i2cdetect -y 1 → should show 0x${(state.config.i2cAddress ?? 0).toString(16)}`);
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  const pkg = state.config.interface === 'spi' ? 'spi-device' : 'i2c-bus';
  const error = `IMU driver not yet implemented. ` +
    `Install ${pkg}: npm install ${pkg}. ` +
    `Then read WHO_AM_I register to verify chip identity before enabling ODR.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Read Sample ─────────────────────────────────────────────────────────────

export function readIMUSample(
  state: IMUDriverState,
): { state: IMUDriverState; reading: IMURawReading | null; error: string | null } {
  if (state.status !== 'ready') {
    return { state, reading: null, error: `IMU not ready: ${state.status}` };
  }
  const error = `IMU read not yet implemented.`;
  return { state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error }, reading: null, error };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getIMUDriverHealth(state: IMUDriverState): IMUDriverStatus {
  return state.status;
}

export function shutdownIMUDriver(state: IMUDriverState): IMUDriverState {
  // TODO: set IMU to power-down mode; close device fd
  return { ...state, status: 'closed' };
}
