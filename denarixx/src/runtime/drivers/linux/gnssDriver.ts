// ─── GNSS Driver ──────────────────────────────────────────────────────────────
// Serial NMEA input driver for u-blox M10 or compatible GNSS module.
//
// Real implementation (physical device required):
//   - Open serial: open("/dev/ttyAMA0", O_RDWR | O_NOCTTY | O_NDELAY)
//   - Configure: tcsetattr() → 9600 baud (u-blox default) or 38400 (configured)
//   - Read NMEA sentences: readline from serial port
//   - Parse GGA: $GPGGA,hhmmss.ss,lat,N,lon,E,fix,sats,hdop,alt,...
//   - Parse VTG: $GPVTG,...,speed_kmh,...
//   - Parse RMC: $GPRMC,...,status,lat,lon,...
//
// Node.js serial binding:
//   npm install serialport    (cross-platform, well-maintained)
//   npm install @serialport/parser-readline  (line-by-line NMEA parsing)
//
// Privacy note:
//   GPS coordinates are fuzzed to 0.01° grid by locationPrivacyEngine.ts
//   before storage or cloud transmission. Raw coords stay on device.
//
// Accuracy:
//   u-blox M10: CEP ~1.5 m open sky. Indoor accuracy significantly worse (5–50 m).
//   Do not rely on GNSS indoors.

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GnssDriverStatus = 'not-initialized' | 'searching' | 'fix-2d' | 'fix-3d' | 'no-fix' | 'failed' | 'closed';
export type GnssFixType = 'none' | '2d' | '3d' | 'dgps';

export interface GnssDriverConfig {
  serialPath: string;       // e.g. /dev/ttyAMA0 or /dev/ttyUSB0
  baudRate: number;         // e.g. 9600 or 38400
  fixTimeoutMs: number;     // time before declaring no-fix (e.g. 30000)
}

export interface GnssReading {
  latitudeDeg: number;       // decimal degrees, WGS-84
  longitudeDeg: number;
  altitudeM: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  fixType: GnssFixType;
  satelliteCount: number;
  hdop: number | null;       // horizontal dilution of precision
  timestampMs: number;
  isSimulated: false;
}

export interface GnssDriverState {
  config: GnssDriverConfig;
  status: GnssDriverStatus;
  fixesReceived: number;
  errorCount: number;
  lastErrorMessage: string | null;
  deviceAccessible: boolean;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGnssDriverState(config: GnssDriverConfig): GnssDriverState {
  const deviceAccessible = fs.existsSync(config.serialPath);
  return {
    config, status: 'not-initialized',
    fixesReceived: 0, errorCount: 0, lastErrorMessage: null,
    deviceAccessible,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeGnssDriver(
  state: GnssDriverState,
): { state: GnssDriverState; error: string | null } {
  if (!state.deviceAccessible) {
    const error = `GNSS serial port not found at ${state.config.serialPath}. ` +
      `Connect u-blox M10 via UART. ` +
      `On RPi CM4: enable UART2 (dtoverlay=uart2) and check /dev/ttyAMA2. ` +
      `List ports: ls /dev/tty{AMA,USB,ACM}*`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  const error = `GNSS driver not yet implemented. ` +
    `Install serialport: npm install serialport @serialport/parser-readline. ` +
    `Open ${state.config.serialPath} at ${state.config.baudRate} baud and parse NMEA GGA/RMC sentences.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Read Fix ─────────────────────────────────────────────────────────────────

export function readGnssFix(
  state: GnssDriverState,
): { state: GnssDriverState; reading: GnssReading | null; error: string | null } {
  if (state.status === 'failed' || state.status === 'not-initialized') {
    return { state, reading: null, error: `GNSS not ready: ${state.status}` };
  }
  const error = `GNSS read not yet implemented.`;
  return { state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error }, reading: null, error };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getGnssDriverHealth(state: GnssDriverState): GnssDriverStatus {
  return state.status;
}

export function shutdownGnssDriver(state: GnssDriverState): GnssDriverState {
  // TODO: close serial port; disable GNSS module if power-controlled via GPIO
  return { ...state, status: 'closed' };
}
